Meteor.startup(function() {
	var timer,
		time = 10000,
		status;

	var startTimer = function() {
		timer = setTimeout(function() {
			if (status !== 'away') {
				status = 'away';
				Meteor.call('UserPresence:away');
			}
		}, time);
	};

	Deps.autorun(function() {
		Meteor.user();
		status = Meteor.user().statusConnection;
		startTimer();
	});

	var onAction = function() {
		if (status !== 'online') {
			status = 'online';
			Meteor.call('UserPresence:online');
		}
		clearTimeout(timer);
		startTimer();
	};

	document.addEventListener('mousemove', onAction);
	document.addEventListener('mousedown', onAction);
	document.addEventListener('keydown', onAction);
});