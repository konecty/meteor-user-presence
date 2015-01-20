Package.describe({
  name: 'konecty:user-presence',
  summary: 'Track user status',
  version: '1.0.5',
  git: 'https://github.com/Konecty/meteor-user-presence'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0.2.1');

  api.addFiles('server/server.js', ['server']);
  api.addFiles('server/monitor.js', ['server']);
  api.addFiles('client/client.js', ['client']);
  api.addFiles('common/common.js');

  api.export(['UserPresence'], ['server']);
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('konecty:user-presence');
  api.addFiles('konecty:user-presence-tests.js');
});
