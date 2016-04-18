var env = require('node-env-file');
var MongoClient = require('mongodb').MongoClient;
var smtpServer = require('smtp-server').SMTPServer;
var MailParser = require("mailparser").MailParser;
var mailparser = new MailParser();

// setup the server listener
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

// handle the end of mail input
mailparser.on("end", function(mail_object){
    
    // wipe the content of the attachments - we don't store these at this time
    for(var x in mail_object.attachments) {
        mail_object.attachments[x].content = null;
    }

    // connect to mongo
    MongoClient.connect(process.env.MONGO_URL, function(err, db) {
        // log any errors
        if(err) {
            console.log(err);
            return;
        }

        // insert the record
        db.collection('emails').insertOne(mail_object, function(err, result) {
            if(err) console.log(err);
        });
    });
});

server.listen(25);
