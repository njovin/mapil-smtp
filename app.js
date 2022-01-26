var env = require('node-env-file');
var MongoClient = require('mongodb').MongoClient;
var smtpServer = require('smtp-server').SMTPServer;
var MailParser = require("mailparser").MailParser;
const { Pool, Client } = require('pg')
var http = require('http');
var request = require('request');

// load the .env file, if any
env(__dirname + '/.env');

const pool = new Pool({
    process.env.POSTGRES_CONNECTION,
});

// spin up the SMTP server
var server = new smtpServer({
	name: process.env.SMTP_SERVER_NAME,
	banner: process.env.SMTP_BANNER,
	size: process.env.MAX_MESSAGE_SIZE,
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

        console.info('Mail received for ' + address.address);
        // make sure the doman is valid
        if(address.address.substr(-14) !== '@' + process.env.SMTP_HOST_CHECK){
            return cb(new Error('Only mail for ' + process.env.SMTP_HOST_CHECK + ' is accepted'));
    	}

        // make sure the address is valid
        validateEmailAddress(address.address,session,cb);
	}
});

server.listen(process.env.SMTP_PORT);

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
        db.collection(process.env.MONGO_MESSAGE_COLLECTION).insertOne(mail_object, function(err, result) {
            if(err) console.log(err);

            request.post({url: 'https://mapil.co/internal/webhook', body: mail_object, json:true}, function (error, response, body) {
                console.error('error:', error); // Print the error if one occurred
                console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                console.log('body:', body); // Print the HTML for the Google homepage.
            });
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
    pool.query('SELECT * FROM email_addresses WHERE email = $1 AND deleted_at IS NULL', [address], function(err, result) {
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

if(process.env.HEARTBEAT_ENABLED) {
    sendHeartbeat();
}
