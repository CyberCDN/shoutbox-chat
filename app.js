var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    mongoose = require('mongoose'),
    net = require("net"),
    countusers = 0,
    config = require("./config"),
    users = {};
    server.listen(3000);

chatClients = new Object();

mongoose.connect('mongodb://localhost/chat', function (err) {
    if (err) console.log(err);
    else console.log('Connected to mongodb!');
});

var chatSchema = mongoose.Schema({ nick: String, msg: String, time: String, created: {type: Date, default: Date.now} });
var Chat = mongoose.model('Message', chatSchema);

app.get('/', function (req, res) { 
  res.sendfile(__dirname + '/index.html'); 
});

function pad(n) {
    return ( n<10 ? '0'+ n : n);
}

io.sockets.on('connection', function(socket){
	var address = socket.handshake.address;
	var userip = address.address;

	var query = Chat.find({});
	query.sort('-created').limit(32).exec(function(err, docs){
		if(err) throw err;
		socket.emit('load old msgs', docs);
	});
	
	administrator = config.administrators.some(function(administrator) {
	  return administrator == address.address;
	});

	socket.on('new user', function(data, callback){
		if (data in users){
			callback(false);
		} else{
			callback(true);
			data = data.replace(/\s/g, '');
			socket.nickname = data;
			users[socket.nickname] = socket;

			var clientsAdmin = '<a href="#" class="set" id="' + socket.id + '" title="' + socket.nickname + '">' + socket.nickname + '</a>';
			chatClients[clientsAdmin] = socket; // FIXME
			countusers++;
			updateNicknames();

			var currentDate = new Date(),
			    msgTime = pad(currentDate.getHours()) +":"+ pad(currentDate.getMinutes()) +":"+ pad(currentDate.getSeconds());

			socket.emit('new message', {msg: 'Welcome on the chat, keep calm and have fun ' + socket.nickname + ' :)', nick: '*', time: msgTime});
		}
	});
	
	function updateNicknames(){
		io.sockets.emit('usernames', Object.keys(users));
		io.sockets.emit('usersadm', Object.keys(chatClients));
		socket.emit('user nickname', socket.nickname);
		io.sockets.emit('count users', countusers);
		if(administrator) io.sockets.emit('show adm', {msg: 'ok'});
	}

	socket.on('send message', function(data, callback){

		function urls(text) {
		    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
		    return text.replace(exp,"<a href='$1' target='_blank'>[LINK]</a>");
		}

		var msg = urls(data.trim());
		var msg = msg.replace(/\s+/g, ' ');

		if(msg.substr(0,3) === '/w '){
			msg = msg.substr(3);
			var ind = msg.indexOf(' ');
			if(ind !== -1){
				var name = msg.substring(0, ind);
				var msg = msg.substring(ind + 1);
				if(name in users){
					if (socket.nickname === undefined) {
						var currentDate = new Date(),
						    msgTime = pad(currentDate.getHours()) +":"+ pad(currentDate.getMinutes()) +":"+ pad(currentDate.getSeconds());

						socket.emit('new message', {msg: 'Error! Please log in again!', nick: '*', time: msgTime}); 
					} else {
						users[name].emit('whisper', {msg: msg, nick: '=> From: ' + socket.nickname});
						socket.emit('get info', 'Your private message has been successfully sent to ' + name);
					}
				} else{
					callback('Error!  Enter a valid user.');
				}
			} else{
				callback('Error!  Please enter a message for your whisper.');
			}
		} else if(msg.substr(0,3) === '/k '){
			msg = msg.substr(3);
			var ind = msg.indexOf(' ');
			if(ind !== -1){
				var name = msg.substring(0, ind);
				var msg = msg.substring(ind + 1);
				if(name in users){
					if(administrator && socket.nickname !== undefined) {
					    io.sockets.emit('whisper', {msg: socket.nickname + " kicked " + name + "! If you want, you can now log in again.", nick: socket.nickname});
		                            socket.manager.onClientDisconnect(msg);
					} else{
						callback('You have no permission to this!');
					}
				} else{
					callback('Error!  Enter a valid user.');
				}
			} else{
				callback('Error!  Please enter a nick name for kick user.');
			}

		} else{
			var currentDate = new Date(),
			    msgTime = pad(currentDate.getHours()) +":"+ pad(currentDate.getMinutes()) +":"+ pad(currentDate.getSeconds());

			if (socket.nickname === undefined) {
				socket.emit('new message', {msg: 'Error! Please log in again!', nick: '*', time: msgTime}); 
			} else {
				var newMsg = new Chat({msg: msg, nick: socket.nickname, time: msgTime});
				newMsg.save(function(err){
					if(err) throw err;
					io.sockets.emit('new message', {msg: msg, nick:  socket.nickname, time: msgTime});
				});
			}
		}
	});
	
	socket.on('disconnect', function(data){
		if(!socket.nickname) return;
		delete users[socket.nickname];

		var clientsAdmin = '<a href="#" class="set" id="' + socket.id + '" title="' + socket.nickname + '">' + socket.nickname + '</a>';
		delete chatClients[clientsAdmin];
		countusers--;
		updateNicknames();
	});
});
