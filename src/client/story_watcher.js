import Events   from "events"
import Firebase from "firebase"
import Moment   from "moment"
import URL      from "url"
import _        from "underscore"

export default class StoryWatcher extends Events.EventEmitter {
  constructor(url) {
    super()
    this.maxNumOfStories = 20 // TODO: make it configurable
    this.fb = new Firebase(url)
    this.fbRefs = {}
    this.fbFuns = {}
  }
  onStoryChange(type, storyIds) {
    var self     = this
    var count    = 0

    storyIds.forEach(function(storyId) {
      var index = parseInt(storyId.key())
      var id    = storyId.val()

      self.fb.child('item/' + id).once('value', function(storySnapshot) {
        var story = storySnapshot.val()
        if (!story) {
          self.emit(errEvent, new Error("Error loading " + storySnapshot.key()))
          return
        }

        story.rank    = index
        story.timeAgo = Moment.unix(story.time).fromNow()
        story.yurl    = self.getYurl(story.id)
        if (_.isEmpty(story.url)) {
          story.url = story.yurl
        } else {
          story.host = URL.parse(story.url).hostname
        }

        self.emit(type, story)
      }, function(err) {
        self.emitError(type, story)
      })

      return ++count == self.maxNumOfStories
    })
  }
  getYurl(id) {
    return "https://news.ycombinator.com/item?id=" + id
  }
  getChildName(type) {
    var child = ""
    if (type == "top") {
      child = "topstories"
    } else if (type == "show") {
      child = "showstories"
    } else if (type == "ask") {
      child = "askstories"
    } else {
      throw new Error("Unsupported watch type " + type)
    }

    return child
  }
  watch(type, callback, errback) {
    if (callback != null) {
      this.on(type, callback)
    }

    if (errback != null) {
      this.on(type + "-error", errback)
    }

    this.fbRefs[type] = this.fb.child(this.getChildName(type))
    this.fbFuns[type] = this.fbRefs[type].on("value", this.onStoryChange.bind(this, type), function(err) {
      this.emitError(type, err)
    }.bind(this))
  }
  unwatchAll() {
    _.each(this.fbRefs, function(ref, type) {
      ref.off("value", this.fbFuns[type])
      delete this.fbRefs[type]
      delete this.fbFuns[type]

      this.removeAllListeners(type)
      this.removeAllListeners(type + "-error")
    }, this)
  }
  emitError(type, obj) {
    this.emit(type + "-error", errorObject)
  }
}