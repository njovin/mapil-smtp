var smtpServer = require('smtp-server').SMTPServer;

var server = new smtpServer({
	name: "mapil-smtp",
	banner: "mail.mapil.co",
	size: 1048576,
	disabledCommands: ['AUTH'],
	onMailFrom: function(address, session, cb) {
		console.log('from ' + address.address);
		return cb();
	},
	onRcptTo: function(address, session, cb) {
		console.log('recip to ' + address.address);
	        if(address.address.substr(-14) !== '@mail.mapil.co'){
	            return cb(new Error('Only mail for mapil.co is accepted'));
        	}
		return cb();
	}
});
server.listen(25);
