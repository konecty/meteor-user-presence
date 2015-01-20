var timer, status;

UserPresence = {
	awayTime: 60000, //1 minute
	awayOnWindowBlur: false,

	startTimer: function() {
		timer = setTimeout(UserPresence.setAway, UserPresence.awayTime);
	},
	stopTimer: function() {
		clearTimeout(timer);
	},
	setAway: function() {
		if (status !== 'away') {
			status = 'away';
			Meteor.call('UserPresence:away');
		}
		UserPresence.stopTimer();
	},
	setOnline: function() {
		if (status !== 'online') {
			status = 'online';
			Meteor.call('UserPresence:online');
		}
		UserPresence.stopTimer();
		UserPresence.startTimer();
	},
	start: function() {
		Deps.autorun(function() {
			var user = Meteor.user();
			status = user && user.statusConnection;
			UserPresence.startTimer();
		});

		document.addEventListener('mousemove', UserPresence.setOnline);
		document.addEventListener('mousedown', UserPresence.setOnline);
		document.addEventListener('keydown', UserPresence.setOnline);
		window.addEventListener('focus', UserPresence.setOnline);

		if (UserPresence.awayOnWindowBlur === true) {
			window.addEventListener('blur', UserPresence.setAway);
		}
	}
}
