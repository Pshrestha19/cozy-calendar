// Generated by CoffeeScript 1.8.0
var Event, MailHandler, User, VCalendar, log, mails, moment, time;

time = require('time');

moment = require('moment');

log = require('printit')({
  prefix: 'events'
});

User = require('../models/user');

Event = require('../models/event');

VCalendar = require('cozy-ical').VCalendar;

MailHandler = require('../mails/mail_handler');

mails = new MailHandler();

module.exports.fetch = function(req, res, next, id) {
  return Event.find(id, (function(_this) {
    return function(err, event) {
      var acceptLanguage;
      if (err || !event) {
        acceptLanguage = req.headers['accept-language'];
        if ((acceptLanguage != null ? acceptLanguage.indexOf('text/html') : void 0) !== -1) {
          return res.send({
            error: "Event not found"
          }, 404);
        } else {
          return res.send("Event not found: the event is probably canceled.", 404);
        }
      } else {
        req.event = event;
        return next();
      }
    };
  })(this));
};

module.exports.all = function(req, res) {
  return Event.all(function(err, events) {
    var evt, index, _i, _len;
    if (err) {
      return res.send({
        error: 'Server error occurred while retrieving data'
      });
    } else {
      for (index = _i = 0, _len = events.length; _i < _len; index = ++_i) {
        evt = events[index];
        events[index] = evt.timezoned();
      }
      return res.send(events);
    }
  });
};

module.exports.read = function(req, res) {
  return res.send(req.event.timezoned());
};

module.exports.create = function(req, res) {
  var create, data, event, start;
  data = Event.toUTC(req.body);
  create = function() {
    return Event.create(data, (function(_this) {
      return function(err, event) {
        if (err) {
          return res.error("Server error while creating event.");
        }
        return res.send(event.timezoned(), 201);
      };
    })(this));
  };
  if (data["import"]) {
    event = new Event(data);
    start = event.getCouchStartDate();
    return Event.request('byDate', {
      key: start
    }, function(err, events) {
      if (err) {
        console.log(err);
        return create();
      } else if (events.length === 0) {
        return create();
      } else if (data.description === events[0].description) {
        log.warn('Event already exists, it was not created.');
        return res.send(events[0].timezoned(), 201);
      } else {
        return create();
      }
    });
  } else {
    return create();
  }
};

module.exports.update = function(req, res) {
  var data, start;
  start = req.event.start;
  data = Event.toUTC(req.body);
  return req.event.updateAttributes(data, (function(_this) {
    return function(err, event) {
      var dateChanged;
      if (err != null) {
        return res.send({
          error: "Server error while saving event"
        }, 500);
      } else {
        dateChanged = data.start !== start;
        return mails.sendInvitations(event, dateChanged, function(err, event2) {
          if (err) {
            console.log(err);
          }
          return res.send((event2 || event).timezoned(), 200);
        });
      }
    };
  })(this));
};

module.exports["delete"] = function(req, res) {
  return req.event.destroy(function(err) {
    if (err != null) {
      return res.send({
        error: "Server error while deleting the event"
      }, 500);
    } else {
      return mails.sendDeleteNotification(req.event, function() {
        return res.send({
          success: true
        }, 200);
      });
    }
  });
};

module.exports["public"] = function(req, res) {
  var date, dateFormat, key, visitor, _ref;
  key = req.query.key;
  if (!(visitor = req.event.getGuest(key))) {
    return res.send({
      error: 'invalid key'
    }, 401);
  }
  if ((_ref = req.query.status) === 'ACCEPTED' || _ref === 'DECLINED') {
    return visitor.setStatus(req.query.status, (function(_this) {
      return function(err) {
        if (err) {
          return res.send({
            error: "server error occured"
          }, 500);
        }
        res.header({
          'Location': "./" + req.event.id + "?key=" + key
        });
        return res.send(303);
      };
    })(this));
  } else {
    dateFormat = 'MMMM Do YYYY, h:mm a';
    date = moment(req.event.start).format(dateFormat);
    return res.render('event_public.jade', {
      event: req.event.timezoned(),
      date: date,
      key: key,
      visitor: visitor
    });
  }
};

module.exports.ical = function(req, res) {
  var calendar, key;
  key = req.query.key;
  calendar = new VCalendar('Cozy Cloud', 'Cozy Agenda');
  calendar.add(req.event.toIcal());
  res.header({
    'Content-Type': 'text/calendar'
  });
  return res.send(calendar.toString());
};

module.exports.publicIcal = function(req, res) {
  var calendar, key, visitor;
  key = req.query.key;
  if (!(visitor = req.event.getGuest(key))) {
    return res.send({
      error: 'invalid key'
    }, 401);
  }
  calendar = new VCalendar('Cozy Cloud', 'Cozy Agenda');
  calendar.add(req.event.toIcal());
  res.header({
    'Content-Type': 'text/calendar'
  });
  return res.send(calendar.toString());
};