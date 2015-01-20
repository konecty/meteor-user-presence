Meteor.startup(function() {
	var timer,
		time = 10000;

	var startTimer = function() {
		timer = setTimeout(function() {
			if (Meteor.user().status !== 'away') {
				Meteor.call('UserPresence:away');
			}
		}, time);
	};
	startTimer();

	var onAction = function() {
		if (Meteor.user().status !== 'online') {
			Meteor.call('UserPresence:online');
		}
		clearTimeout(timer);
		startTimer();
	};

	document.addEventListener('mousemove', onAction);
	document.addEventListener('mousedown', onAction);
	document.addEventListener('keydown', onAction);
});