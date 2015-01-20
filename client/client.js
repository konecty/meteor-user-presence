Meteor.startup(function() {
	Deps.autorun(function() {
		var status = Meteor.status();
		if (status.status === 'connected') {
			// Meteor.call('UserPresence:connect');
		}
	});
});