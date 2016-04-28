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
            mailparser.mapil_email = session.mapil_email;
           	mailparser.write(email);
       		mailparser.end();	
            mailparser.on("end", storeEmail);
		});
        callback();
	},
	onRcptTo: function(address, session, cb) {
        address.address = address.address.toLowerCase();
        // make sure the doman is valid
        if(address.address.substr(-14) !== '@mail.mapil.co'){
            return cb(new Error('Only mail for mail.mapil.co is accepted'));
    	}
        // make sure the address is valid 
        validateEmailAddress(address.address,session,cb);
	}
});

server.listen(25);

/**
 * Store the email in mongo
 * @param  {[type]} mail_object [description]
 * @return {[type]}             [description]
 */
function storeEmail(mail_object)
{
    mail_object.user_id = this.user_id;
    mail_object.mapil_email = this.mapil_email;
    mail_object.received_at = new Date();
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

/**
 * Validate that an email address exists in the system
 * @param  {[type]}   address [description]
 * @param  {[type]}   session [description]
 * @param  {Function} cb      [description]
 * @return {[type]}           [description]
 */
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
                session.mapil_email = result.rows[0].email;
                return cb();
            }
        });
    });    
}

/**
 * Send a heartbeat HTTP request to our service monitor 
 * @return {[type]} [description]
 */
function sendHeartbeat() 
{
    http.get(process.env.HEARTBEAT_URL, function(res) {
            setTimeout(sendHeartbeat,60000);
        }).on('error', function(e) {
            setTimeout(sendHeartbeat,60000);
            console.log("Error sending heartbeat: " + e);
    });
}

sendHeartbeat();
