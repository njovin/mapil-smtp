var env = require('node-env-file');
var MongoClient = require('mongodb').MongoClient;
var smtpServer = require('smtp-server').SMTPServer;
var MailParser = require("mailparser").MailParser;
var pg = require('pg');

// setup the server listener
env(__dirname + '/.env');
var server = new smtpServer({
	name: "mapil-smtp",
	banner: "mail.mapil.co",
	size: 10485760,
	disabledCommands: ['AUTH'],
	onData: function(stream, session, callback){
		var email = '';
		stream.on('data', function(buffer) {
    		var part = buffer.toString();
    		email += part;
		});
		stream.on('end', function() {
            var mailparser = new MailParser();
            mailparser.user_id = session.user_id;
           	mailparser.write(email);
       		mailparser.end();	
		});
	},
	onRcptTo: function(address, session, cb) {
        address.address = address.address.toLowerCase();
        // make sure the doman is valid
        if(address.address.substr(-14) !== '@mail.mapil.co'){
            return cb(new Error('Only mail for mail.mapil.co is accepted'));
    	}
        // make sure the address is valid 
        validateEmailAddress(address.address,cb);
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

function validateEmailAddress(address, session, cb) {
    pg.connect(process.env.POSTGRES_CONNECTION, function(err, client, done) {
        if(err) {
            return console.error('error fetching client from pool', err);
        }
        client.query('SELECT * FROM email_addresses WHERE email = $1 AND deleted_at IS NULL', [address], function(err, result) {
            done();
            if(err) {
                return console.error('error running query', err);
            }
            if(result.rowCount < 1) {
                return cb(new Error('Unrecognized address'));
            } else {
                session.user_id = result.rows[0].user_id;
                return cb();
            }
        });
    });    
}
