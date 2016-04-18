var env = require('node-env-file');
var MongoClient = require('mongodb').MongoClient;
var smtpServer = require('smtp-server').SMTPServer;
var MailParser = require("mailparser").MailParser;
var mailparser = new MailParser();
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
        validateEmailAddress(address.address,function(matching_addresses) {
            if(matching_addresses.length === 0) {
                return cb(new Error('Unrecognized address'));
            } else {
                cb();
            }
        });
	}
});

// handle the end of mail input
mailparser.on("end", function(mail_object)
{
    // lookup the address so we have the user id 
    lookupAddress(mail_object.to.address.toLowerCase(), function(matching_addresses) {
        if(matching_addresses.length == 1) {
            mail_object.user_id = matching_addresses[0].user_id;
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
        }
    });  

});

server.listen(25);

function lookupAddress(address, cb) {
    pg.connect(process.env.POSTGRES_CONNECTION, function(err, client, done) {
        if(err) {
            return console.error('error fetching client from pool', err);
        }
        client.query('SELECT * FROM email_addresses WHERE email = $1 AND deleted_at IS NULL', [address], function(err, result) {
            done();
            if(err) {
                return console.error('error running query', err);
            }
            cb(result.rows);
        });
    });    
}
