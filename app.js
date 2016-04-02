var smtpServer = require('smtp-server').SMTPServer;
var MailParser = require("mailparser").MailParser;
var mailparser = new MailParser();

var server = new smtpServer({
	name: "mapil-smtp",
	banner: "mail.mapil.co",
	size: 1048576,
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
console.log(JSON.stringify(mail_object));
//    console.log("From:", mail_object.from); //[{address:'sender@example.com',name:'Sender Name'}]
 //   console.log("Subject:", mail_object.subject); // Hello world!
  //  console.log("Text body:", mail_object.text); // How are you today?
});



server.listen(25);
