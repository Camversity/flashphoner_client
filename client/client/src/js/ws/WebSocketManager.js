var WebSocketManager = function (url, localVideoPreview, remoteVideo) {
    var me = this;
    me.url = url;
    me.calls = [];
    me.isOpened = false;
    me.configLoaded = false;
    me.webRtcMediaManager = new WebRtcMediaManager(localVideoPreview, remoteVideo);
    var rtcManager = this.webRtcMediaManager;

    var proccessCall = function(call){
        for (var i in me.calls) {
            if (call.id == me.calls[i].id){
                me.calls[i] = call;
                return;
            }
        }
        me.calls.push(call);
        notifyAddCall(call);
    };

    this.callbacks = {
        getUserData: function(user) {
            me.user = user;
            notifyRegisterRequired(user.regRequired);
        },

        getVersion: function(version) {
            notifyVersion(version);
        },

        registered: function(sipHeader) {
            notifyRegistered();
        },

        ring: function(call, sipHeader) {
            proccessCall(call);
            notify(call);
        },

        sessionProgress: function(call, sipHeader) {
            proccessCall(call);
        },

        setRemoteSDP: function(call, sdp, isInitiator, sipHeader) {
            proccessCall(call);
            rtcManager.setRemoteSDP(call, sdp, isInitiator);
            if (!isInitiator && rtcManager.getConnectionState() == "established"){
                me.answer(call.id, true, false);
            }
        },

        talk: function(call, sipHeader) {
            proccessCall(call);
            notify(call);
        },

        hold: function(call, sipHeader) {
            proccessCall(call);
            notify(call);
        },

        callbackHold: function(call, isHold) {
            proccessCall(call);
            notifyCallbackHold(call);
        },

        finish: function(call, sipHeader) {
            proccessCall(call);
            notify(call);
            notifyRemoveCall(call);
            rtcManager.close();
        },

        busy: function(call, sipHeader) {
            proccessCall(call);
            notify(call);
        },

        fail: function(errorCode, sipHeader) {
            notifyError(errorCode);
        },

        notifyVideoFormat: function(call) {
            proccessCall(call);
            //notifyVideoFormat(call);
        },

        notifyMessage: function(message) {
            notifyMessage(message);
        },

        notifyAudioCodec: function(codec) {
        }
    };


};

WebSocketManager.prototype = {

    login: function (loginObject) {
        var me = this;
        me.webSocket = $.websocket(me.url, {
            open: function() {
                me.isOpened = true;
                me.webSocket.send("connect", loginObject);
            },
            close: function(event) {
                me.isOpened = false;
                if (!event.originalEvent.wasClean) {
                    notifyError(CONNECTION_ERROR);
                }
                notifyCloseConnection();
            },
            error:function () {
            },
            context:me,
            events: me.callbacks
        });
        return 0;
    },

    logoff:function(){
        this.webSocket.close();
    },

    call: function (callRequest) {
        var me = this;
        this.webRtcMediaManager.createOffer(function(sdp) {
            callRequest.sdp = sdp;
            me.webSocket.send("call", callRequest);
        }, true, false);
        return 0;
    },

    setSendVideo: function (callId, hasVideo) {
        var me = this;
        this.webRtcMediaManager.createOffer(function(sdp) {
            callRequest.sdp = sdp;
            me.webSocket.send("changeMediaRequest", {callId:callId, sdp:sdp});
        }, true, hasVideo);
        return 0;
    },

    answer: function(callId, hasAudio, hasVideo) {
        var me = this;
        this.webRtcMediaManager.createAnswer(function(sdp) {
            me.webSocket.send("answer", {callId:callId, sdp:sdp});
        }, hasAudio, hasVideo);
    },

    hangup: function(callId) {
        this.webSocket.send("hangup", callId);
    },

    viewVideo: function(){
        this.webRtcMediaManager.viewVideo();
    },

    viewAccessMessage:function() {

    },

    isMuted: function(){
        return -1;
    },

    getInfoAboutMe: function () {
        return this.user;
    },

    getCookie: function (c_name) {
        var i, x, y, ARRcookies = document.cookie.split(";");
        for (i = 0; i < ARRcookies.length; i++) {
            x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
            x = x.replace(/^\s+|\s+$/g, "");
            if (x == c_name) {
                return ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
            }
        }
    },

    setCookie: function (c_name, value) {
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + 100);
        var c_value = escape(value) + "; expires=" + exdate.toUTCString();
        document.cookie = c_name + "=" + c_value;
    }

};
