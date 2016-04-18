var env = require('node-env-file');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var smtpServer = require('smtp-server').SMTPServer;
var MailParser = require("mailparser").MailParser;
var mailparser = new MailParser();
//var mongoose = require('mongoose');

env(__dirname + '/.env');
var server = new smtpServer({
	name: "mapil-smtp",
	banner: "mail.mapil.co",
	size: 10485760,
	disabledCommands: ['AUTH'],
	onMailFrom: function(address, session, cb) {
		console.log('from ' + address.address);
		return cb();
	},
	onData: function(stream, session, callback){
		var email = '';
		stream.on('data', function(buffer) {
		var part = buffer.toString();
			email += part;
		});
		stream.on('end', function() {
	        	mailparser.write(email);
        		mailparser.end();	
		});
	},
	onRcptTo: function(address, session, cb) {
		console.log('recip to ' + address.address);
	        if(address.address.substr(-14) !== '@mail.mapil.co'){
	            return cb(new Error('Only mail for mapil.co is accepted'));
        	}
		return cb();
	}
});

mailparser.on("end", function(mail_object){
for(var x in mail_object.attachments) {
mail_object.attachments[x].content = null;
}
MongoClient.connect(process.env.MONGO_URL, function(err, db) {
console.log(err);
   db.collection('emails').insertOne(mail_object
   , function(err, result) {
	console.log(err);
  });
});
console.log(JSON.stringify(mail_object));
    console.log("From:", mail_object.from); //[{address:'sender@example.com',name:'Sender Name'}]
   console.log("Subject:", mail_object.subject); // Hello world!
  console.log("Text body:", mail_object.text); // How are you today?
console.log(JSON.stringify(mail_object));
});



server.listen(25);
