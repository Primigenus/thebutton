Clicks = new Mongo.Collection("clicks");
Timer = new Mongo.Collection("timer");
var TIMER_INIT = 1000 * 60;

if (Meteor.isClient) {

  // We'll use this to update the pie chart more
  // frequently (every 10ms) without hitting the server
  var clientTimer = new ReactiveVar(TIMER_INIT);

  Meteor.startup(function() {
    Meteor.subscribe("userData");
    Meteor.subscribe("clicks");
    Meteor.subscribe("timer");

    var interval;
    Tracker.autorun(function() {
      var timer = Timer.findOne();
      if (timer && timer.value > 0 && timer.value % 1000 == 0) {
        clearInterval(interval);
        clientTimer.set(timer.value);
        interval = Meteor.setInterval(function() {
          clientTimer.set(clientTimer.get() - 10);
        }, 10);
      }
    });

    google.setOnLoadCallback(function() {
      var options = {
        backgroundColor: "transparent",
        pieSliceBorderColor: "transparent",
        slices: { 0: {color: "#C8C8C8"}, 1: {color: "#4A4A4A"} },
        width: 120,
        height: 120,
        legend: 'none',
        pieSliceText: 'none',
        enableInteractivity: false
      };

      var chart = new google.visualization.PieChart($(".thebutton-piechart")[0]);
      chart.draw(google.visualization.arrayToDataTable([
        ['', ''],
        ["gone", TIMER_INIT - clientTimer.get()],
        ["remaining", clientTimer.get()]
      ]), options);

      Tracker.autorun(function() {
        if (clientTimer.get() <= 0) return;
        chart.draw(google.visualization.arrayToDataTable([
          ['', ''],
          ["gone", TIMER_INIT - clientTimer.get()],
          ["remaining", clientTimer.get()]
        ]), options);
      });
    });
  });

  Template.body.helpers({
    numParticipants: function() {
      return Clicks.find().count();
    }
  });

  Template.thebutton.helpers({
    timeRemainingWhenClicked: function() {
      var click = Clicks.findOne({userId: Meteor.userId()});
      if (click) {
        var rem = Math.round(click.timeRemaining / 1000);
        if (rem < 10)
          rem = "0" + rem;
        return rem;
      }
    },
    clicked: function() {
      if (!Meteor.userId()) return;
      return moment(Meteor.user().date).format("MMM DD \\a\\t HH:mm:ss");
    },
    timeRemaining: function() {
      if (!Timer.findOne()) return;
      return Timer.findOne().value > 0;
    }
  });

  Template.thebutton.events({
    'click button': function(evt) {
      if (!Meteor.user()) return;
      var change = { timeRemaining: Timer.findOne().value, date: new Date() };
      var userId = { userId: Meteor.userId() };

      var click = Clicks.findOne(userId);
      if (!click) {
        Clicks.insert(_.extend(change, userId));
        Meteor.users.update(Meteor.userId(), {$set: change});
      }
    }
  });

  Template.countdown.helpers({
    countdown60s: function() {
      if (!Timer.findOne()) return;
      var secs = clientTimer.get() / 1000;
      return secs >= 10 ? String(secs)[0] : 0;
    },
    countdown10s: function() {
      if (!Timer.findOne()) return;
      var secs = clientTimer.get() / 1000;
      return secs >= 10 ? String(secs)[1] : String(secs)[0];
    },
    countdown100ms: function() {
      if (!Timer.findOne()) return;
      var ms = clientTimer.get() % 1000;
      return ms > 100 ? String(ms)[0] : 0;
    },
    countdown10ms: function() {
      if (!Timer.findOne()) return;
      var ms = clientTimer.get() % 1000;
      return ms > 100 ? String(ms)[1] : String(ms)[0];
    }
  });

}

if (Meteor.isServer) {

  var serverTimer;

  Meteor.startup(function() {
    serverTimer = TIMER_INIT;
    var timer = Timer.findOne();
    if (timer) {
      Meteor.setInterval(function() {
        Timer.update(timer._id, {$set: {value: serverTimer}});
        serverTimer -= 1000;
        if (Timer.findOne().value < 0) {
          Timer.update(timer._id, {$set: {value: TIMER_INIT}});
          serverTimer = TIMER_INIT;
        }
      }, 1000);
    }
    else
      Timer.insert({value: TIMER_INIT});
  });

  Meteor.methods({
    reset: function() {
      var timer = Timer.findOne();
      if (timer) {
        Timer.update(timer._id, {$set: {value: TIMER_INIT}});
        serverTimer = TIMER_INIT;
      }
    }
  });

  Meteor.publish("timer", function() {
    return Timer.find();
  });

  Meteor.publish("userData", function() {
    return Meteor.users.find({}, {fields: {date: 1}});
  });

  Meteor.users.allow({
    update: function(userId, doc) {
      return Timer.findOne().value > 0 && userId === doc._id;
    }
  });

  Meteor.publish("clicks", function() {
    return Clicks.find();
  });

  Clicks.allow({
    insert: function(userId, doc) {
      if (serverTimer > 0 && userId === doc.userId) {
        var timer = Timer.findOne();
        Timer.update(timer._id, {$set: {value: TIMER_INIT}});
        serverTimer = TIMER_INIT;
        return true;
      }
      return false;
    }
  })

}