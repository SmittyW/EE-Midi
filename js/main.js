var con = null;
var BH = null;

const isHttps = location.protocol == 'https:';
PlayerIO.useSecureApiRequests = isHttps;

function asPromise(func, ...args) {
	return new Promise((resolve, reject) => func(...args, resolve, reject));
}

async function connect() {
	$("#login-btn").val("Connecting...");
	$("#login-btn").prop("disabled", true);
	$("#msgError").empty();
	let roomID = $("#roomID").val().trim();
	let email = $("#email").val();
	let password = $("#password").val();

	if (roomID == "") callbackError({code:"MissingValue", message:"roomID"});
	else {
		try {
			let cli = await asPromise(PlayerIO.authenticate, "everybody-edits-su9rn58o40itdbnw69plyw", "simpleUsers", { email: email, password: password }, { });
			cli.multiplayer.useSecureConnections = isHttps;
			const objPromise = asPromise(cli.bigDB.loadMyPlayerObject);
			const cfgPromise = asPromise(cli.bigDB.load, "config", "config");
			let obj = await objPromise;
			if ("linkedTo" in obj) {
				let auth = await asPromise(cli.multiplayer.createJoinRoom, "auth" + cli.ConnectedUserId, "AuthRoom", true, null, { type: "Link" });
				let msg = await asPromise(auth.addMessageCallback, "auth");
				cli = await asPromise(PlayerIO.authenticate, "everybody-edits-su9rn58o40itdbnw69plyw", "linked", { userId: msg.getString(0), auth: msg.getString(1) }, { });
				cli.multiplayer.useSecureConnections = isHttps;
			}
			let cfg = await cfgPromise;
			con = await asPromise(cli.multiplayer.createJoinRoom, roomID, "Everybodyedits" + cfg.version, true, null, null);
			
			con.addMessageCallback("*", m => {
				switch(m.type) {
					case "init":
						BH = new BlockHandler(con, m.getInt(5), m.getInt(22), m.getInt(23), 100, m);
						$("#login-btn").val("Disconnect");
						$("#login-btn").prop("disabled", false);
						$("#tools :input").prop("disabled", false);
						$("#tools").css("opacity", '1.0');
						break;
					case 'reset':
						BH.clearQueue();
						BH.message(m, "serialised");
						break;
					case 'clear':
						BH.clearQueue();
						BH.message(m, "clear", [{id:m[2],args:[]},{id:0,args:[]}], [{id:m[3],args:[]},{id:0,args:[]}]);
						if (writeOnClear) {
							writeOnClear = false;
							write();
						}
						break;
					case "b":
						BH.message(m, "block", 0);
						break;
					case "br":
						BH.message(m, "block", 4);
						break;
					case "bc":
					case "bs":
					case "lb":
					case "pt":
					case "ts":
					case "wp":
						BH.message(m, "block");
						break;
				}
			});
			con.send("init");

		} catch(e) {
			callbackError(e);
		}
	}
}

function callbackError(error) {
	console.log("ERROR: " + error.code + ": " + error.message);
	$("#msgError").html(error.code);
	disconnect();
}

function disconnect() {
	if (con && con.connected) { 
		con.disconnect();
		con = null;
		BH = null;
		$("#write-btn").val("Write");
	}

	$("#login-btn").val("Connect");
	$("#login-btn").prop("disabled", false);
	$("#tools :input").prop("disabled", true);
	$("#tools").css("opacity", '0.5');
}

$("document").ready(() => {
	$("#tools :input").prop("disabled", true);
	$("#tools").css("opacity", '0.5');
	$("#piano").prop("checked", true);

	$("#file").change(e => {
	    var files = e.target.files;
		if (files.length > 0) {
			var file = files[0];
			parseFile(file);
		}
	});

	$("#login").submit(e => {
		e.preventDefault();

		if (con === null) connect();
		else disconnect();
	});

	$("#write-btn").click(e => {
		e.preventDefault();
		if (!isFinished || BH.placingBlocks)
		{
			isFinished = true;
			BH.clearQueue();
		}
		else writeCheck();
	});

	$("#clear").change(() => {
		let checked = $("#clear").is(":checked");
		$("#clear-status").text((checked) ? "AUTO CLEAR OFF" : "AUTO CLEAR ON");
	});
});
