var connection = null;
var BH = null;

function connect() {
	$("#login-btn").val("Connecting...");
	$("#login-btn").prop("disabled", true);
	$("#msgError").empty();
	var roomID = $("#roomID").val();
	var email = $("#email").val();
	var password = $("#password").val();
	
	PlayerIO.useSecureApiRequests = true;

	PlayerIO.authenticate("everybody-edits-su9rn58o40itdbnw69plyw", "simpleUsers", { email: email, password: password }, {}, client => {		
		client.multiplayer.useSecureConnections = true;

		client.bigDB.load("config", "config", config => {
			client.multiplayer.createJoinRoom(roomID, "Everybodyedits" + config.version, true, null, null, connection => {
				window.connection = connection;
				connection.send("init");
				
				connection.addMessageCallback("*", m => {
					switch(m.type) {
						case "init":
							BH = new BlockHandler(connection, m.getInt(5), m.getInt(22), m.getInt(23), 100, m);
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
			}, callbackError);
		}, callbackError);
	}, callbackError);
}

function callbackError(error) {
	console.log("ERROR: " + error.code + ": " + error.message);
	$("#msgError").html(error.code);
	disconnect();
}

function disconnect() {
	if (connection && connection.connected) { 
		connection.disconnect();
		connection = null;
		BH = null;
		$("#write-btn").val("Write");
	}

	$("#login-btn").val("Connect");
	$("#login-btn").prop("disabled", false);
	$("#tools :input").prop("disabled", true);
	$("#tools").css("opacity", '0.5');
}

$("document").ready(function() {
	$("#tools :input").prop("disabled", true);
	$("#tools").css("opacity", '0.5');
	$("#piano").prop("checked", true);

    $("#file").change(function(e) {
	    var files = e.target.files;
		if (files.length > 0){
			var file = files[0];
			parseFile(file);
		}
	});

    $("#login").submit(function(e) {
		e.preventDefault();

		if (connection === null) connect();
		else disconnect();
	});

	$("#write-btn").click(function(e) {
		e.preventDefault();
		if (!isFinished || BH.placingBlocks)
		{
			isFinished = true;
			BH.clearQueue();
		}
		else writeCheck();
	});

	$("#clear").change(function() {
        if(this.checked) {
            $("#clear-status").text("AUTO CLEAR OFF");
        }
        else $("#clear-status").text("AUTO CLEAR ON");
    });
});