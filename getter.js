var EventEmitter = require("events").EventEmitter;
var https = require("https");
var key = "AIzaSyAXpG8mF9Cw0mYv7Rnps-_0z3K9nO5injw"; // thanks figgyc

const stringify = require("querystring").stringify;

function getThread(getter, commentID) {
	var options = {
		maxResults: 100,
		parentId: commentID,
		part: "snippet",
		textFormat: "plainText",
		key: key
	}

	https.get("https://content.googleapis.com/youtube/v3/comments?" + stringify(options), (res) => {
		if (res.statusCode != 200) getter.emit("error", res.statusCode);

		d = "";

		res.on("data", function(data) {
			d = d + data.toString();
		});

		res.on("end", function() {
			try {
				var data = JSON.parse(d);
			} catch(e) {
				// try again
				return setTimeout(() => getThread(getter, commentID), 0);
			}
			data.items.map(function(item) {
				getter.emit("data", item.snippet);
			});
		});
	}).on("error", function(e) {
		// try yet again
		setTimeout(() => getThread(getter, commentID), 0);
	});
}

function getNext(getter, videoID, pageToken) {
	var options = {
		maxResults: 100,
		moderationStatus: "published",
		order: "time",
		part: "snippet",
		textFormat: "plainText",
		videoId: videoID,
		key: key
	};

	if (pageToken) options.pageToken = pageToken;

	https.get("https://content.googleapis.com/youtube/v3/commentThreads?" + stringify(options), (res) => {
		if (res.statusCode != 200) getter.emit("error", res.statusCode);

		d = "";

		res.on("data", function(data) {
			d = d + data.toString();
		});

		res.on("end", function() {
			try {
				var data = JSON.parse(d);
			} catch(e) {
				// try again
				return setTimeout(() => getNext(getter, videoID, pageToken), 0);
			}
			data.items.map(function(item) {
				getter.emit("data", item.snippet.topLevelComment.snippet);
				if (item.snippet.totalReplyCount > 0) getThread(getter, item.id);
			});
			if (data.nextPageToken) {
				setTimeout(() => getNext(getter, videoID, data.nextPageToken), 0);
			} else {
				getter.emit("end");
			}
		});
	}).on("error", (e) => getter.emit("error", e));
}

module.exports = function(videoID) {
	var Getter = new EventEmitter();

	https.get("https://content.googleapis.com/youtube/v3/videos?" + stringify({
		id: videoID,
		part: "statistics,snippet",
		key: key
	}), function(res) {
		if (res.statusCode != 200) Getter.emit("error", res.statusCode);

		d = "";

		res.on("data", function(data) {
			d = d + data.toString();
		});

		res.on("end", function() {
			var data = JSON.parse(d);
			var stats = data.items[0].statistics;
			stats.published = data.items[0].snippet.publishedAt;
			Getter.emit("stats", stats);
		});
	});

	getNext(Getter, videoID);

	return Getter;
};