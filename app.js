var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    mongoose = require('mongoose'),
    users = {};
	
    server.listen(3000);

mongoose.connect('mongodb://localhost/chat', function (err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Connected to mongodb!');
    }
});

var chatSchema = mongoose.Schema({
    nick: String,
    msg: String,
    time: String,
    created: {type: Date, default: Date.now}
});	

var Chat = mongoose.model('Message', chatSchema);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
	var query = Chat.find({});
	query.sort('-created').limit(16).exec(function(err, docs){
		if(err) throw err;
		socket.emit('load old msgs', docs);
	});
	
	socket.on('new user', function(data, callback){
		if (data in users){
			callback(false);
		} else{
			callback(true);
			socket.nickname = data;
			users[socket.nickname] = socket;
			updateNicknames();
		}
	});
	
	function updateNicknames(){
		io.sockets.emit('usernames', Object.keys(users));
	}

	socket.on('send message', function(data, callback){

		function urls(text) {
		    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
		    return text.replace(exp,"<a href='$1' target='_blank'>[LINK]</a>"); 
		}

		var msg = urls(data.trim());
		console.log('after trimming message is: ' + msg);

		if(msg.substr(0,3) === '/w '){
			msg = msg.substr(3);
			var ind = msg.indexOf(' ');
			if(ind !== -1){
				var name = msg.substring(0, ind);
				var msg = msg.substring(ind + 1);
				if(name in users){
					users[name].emit('whisper', {msg: msg, nick: socket.nickname});
					console.log('message sent is: ' + msg);
					console.log('Whisper!');
				} else{
					callback('Error!  Enter a valid user.');
				}
			} else{
				callback('Error!  Please enter a message for your whisper.');
			}
		} else{
			// If n < 10, add a leading 0
			function pad(n) {
			    return ( n<10 ? '0'+ n : n);
			}

			var currentDate = new Date(),
			    msgTime = pad(currentDate.getHours()) +":"+ pad(currentDate.getMinutes()) +":"+ pad(currentDate.getSeconds());

			var newMsg = new Chat({msg: msg, nick: socket.nickname, time: msgTime});
			newMsg.save(function(err){
				if(err) throw err;
				io.sockets.emit('new message', {msg: msg, nick: socket.nickname, time: msgTime});
			});
		}
	});
	
	socket.on('disconnect', function(data){
		if(!socket.nickname) return;
		delete users[socket.nickname];
		updateNicknames();
	});
});
