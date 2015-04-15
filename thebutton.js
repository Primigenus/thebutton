Clicks = new Mongo.Collection("clicks");
var TIMER_INIT = 1000 * 60;

if (Meteor.isClient) {

  var chartData = [
    ['', ''],
    ["gone", TIMER_INIT - Session.get("timer")],
    ["remaining", Session.get("timer")]
  ]

  var timerMsInterval;
  function updateTime() {
    Meteor.call("getTimer", function(err, res) {
      Session.set("timer", res);
      Session.set("timerMs", res);
      clearInterval(timerMsInterval);
      if (res > 0) {
        timerMsInterval = Meteor.setInterval(function() {
          Session.set("timerMs", Session.get("timerMs") - 10);
        }, 10);
      }
    });
  }

  Meteor.startup(function() {
    Meteor.subscribe("userData");
    Meteor.subscribe("clicks");

    Session.setDefault("timer", TIMER_INIT);
    Session.setDefault("timerMs", TIMER_INIT);

    Meteor.setInterval(updateTime, 1000);

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
      chart.draw(google.visualization.arrayToDataTable(chartData), options);

      Tracker.autorun(function() {
        data = google.visualization.arrayToDataTable([
          ['', ''],
          ["gone", TIMER_INIT - Session.get("timerMs")],
          ["remaining", Session.get("timerMs")]
        ]);
        chart.draw(data, options);
      });
    });
  });

  Template.body.helpers({
    numParticipants: function() {
      return Clicks.find().count();
    }
  })

  Template.thebutton.helpers({
    timeRemainingWhenClicked: function() {
      var click = Clicks.findOne({userId: Meteor.userId()});
      if (click) {
        var rem = click.timeRemaining / 1000;
        if (rem < 10)
          rem = "0" + rem;
        return rem;
      }
    },
    clicked: function() {
      if (!Meteor.userId()) return;
      return moment(Meteor.user().clicked).format("MMM DD \\a\\t HH:mm:ss");
    },
    timeRemaining: function() {
      return !Session.equals("timer", 0);
    }
  });

  Template.thebutton.events({
    'click button': function(evt) {
      if (!Meteor.user()) return;
      var change = { timeRemaining: Session.get("timer"), date: new Date() };
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
      var secs = Session.get("timer") / 1000;
      return secs >= 10 ? String(secs)[0] : 0;
    },
    countdown10s: function() {
      var secs = Session.get("timer") / 1000;
      return secs >= 10 ? String(secs)[1] : String(secs)[0];
    },
    countdown100ms: function() {
      var ms = Session.get("timerMs") % 1000;
      return ms > 100 ? String(ms)[0] : 0;
    },
    countdown10ms: function() {
      var ms = Session.get("timerMs") % 1000;
      return ms > 100 ? String(ms)[1] : String(ms)[0];
    }
  });

}

if (Meteor.isServer) {

  Meteor.startup(function() {
    Timer = new ReactiveVar(TIMER_INIT);

    Meteor.setInterval(function() {
      Timer.set(Math.max(0, Timer.get() - 1000));
    }, 1000);
  });

  Meteor.methods({
    getTimer: function() {
      return Timer.get();
    },
    reset: function() {
      Clicks.remove({});
      Meteor.users.update({}, {$unset: {clicked: 1}}, {multi: true});
      Timer.set(TIMER_INIT);
    }
  });

  Meteor.publish("userData", function() {
    return Meteor.users.find({}, {fields: {clicked: 1}});
  })

  Meteor.users.allow({
    update: function(userId, doc) {
      return Timer.get() > 0 && userId === doc._id;
    }
  });

  Meteor.publish("clicks", function() {
    return Clicks.find();
  })

  Clicks.allow({
    insert: function(userId, doc) {
      if (Timer.get() > 0 && userId === doc.userId) {
        Timer.set(TIMER_INIT);
        return true;
      }
      return false;
    }
  })

}