var WebRtcMediaManager = function (localVideoPreview, remoteVideo, hasVideo) {
    var me = this;

    me.peerConnection = null;
    me.peerConnectionState = 'new';
    me.remoteAudioVideoMediaStream = null;
    me.remoteVideo = remoteVideo;
    me.localVideo = localVideoPreview
};

WebRtcMediaManager.prototype.close = function () {
    if (this.peerConnection) {
        this.remoteVideo.pause();
        this.remoteVideo.src = null;
        this.peerConnection.close();
    }
    this.peerConnection = null;
    this.peerConnectionState = 'new';
    this.remoteAudioVideoMediaStream = null;
};


WebRtcMediaManager.prototype.createPeerConnection = function () {
    console.debug("WebRtcMediaManager:createPeerConnection()");
    var application = this;
    if (webrtcDetectedBrowser == "firefox") {
        pc_config = {"iceServers": [
            {"url": "stun:23.21.150.121"}
        ]};
    } else {
        pc_config = {"iceServers": [
            {"url": "stun:stun.l.google.com:19302"}
        ]};
    }
    this.peerConnection = new RTCPeerConnection(pc_config, {"optional": [
        {"DtlsSrtpKeyAgreement": false}
    ]});

    this.peerConnection.onaddstream = function (event) {
        application.onOnAddStreamCallback(event);
    };

    this.peerConnection.onremovestream = function (event) {
        application.onOnRemoveStreamCallback(event);
    };

    this.peerConnection.onicecandidate = function (rtcIceCandidateEvent) {
        application.onIceCandidateCallback(rtcIceCandidateEvent);
    };
};

WebRtcMediaManager.prototype.onOnAddStreamCallback = function (event) {
    console.debug("WebRtcMediaManager:onOnAddStreamCallback(): event=" + event);
    console.debug("WebRtcMediaManager:onOnAddStreamCallback(): event=" + event.stream);
    console.debug("WebRtcMediaManager:onOnAddStreamCallback(): event=" + this.remoteVideo);
    if (this.peerConnection != null) {
        this.remoteAudioVideoMediaStream = event.stream;
        attachMediaStream(this.remoteVideo, this.remoteAudioVideoMediaStream);
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onOnAddStreamCallback(): this.peerConnection is null, bug in state machine!, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onOnRemoveStreamCallback = function (event) {
    console.debug("WebRtcMediaManager:onOnRemoveStreamCallback(): event=" + event);
    if (this.peerConnection != null) {
        this.remoteAudioVideoMediaStream = null;
        this.remoteVideo.pause();
    } else {
        console.warn("SimpleWebRtcSipPhone:onOnRemoveStreamCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onIceCandidateCallback = function (rtcIceCandidateEvent) {
    if (this.peerConnection != null) {
        if (rtcIceCandidateEvent.candidate == null) {
            if (this.peerConnectionState == 'preparing-offer') {
                this.peerConnectionState = 'offer-sent';
                this.setMySdpFn(this.peerConnection.localDescription.sdp);// + this.candidates);
            }
            else if (this.peerConnectionState == 'preparing-answer') {
                this.peerConnectionState = 'established';
                this.answerCallFn(this.peerConnection.localDescription.sdp);// + this.candidates);
            }
            else if (this.peerConnectionState == 'established') {
            }
            else {
                console.log("WebRtcMediaManager:onIceCandidateCallback(): RTCPeerConnection bad state!");
            }
        }
    }
    else {
        console.warn("WebRtcMediaManager:onIceCandidateCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.viewVideo = function () {
    var me = this;
    if (!me.localAudioVideoStream) {
        getUserMedia({audio: true, video: true}, function (stream) {
            attachMediaStream(me.localVideo, stream);
            me.localAudioVideoStream = stream;
        }, function (error) {
            addLogMessage("Failed to get access to local media. Error code was " + error.code + ".");
        });
    }
};

WebRtcMediaManager.prototype.createOffer = function (setMySdpFn, hasAudio, hasVideo) {
    console.debug("WebRtcMediaManager:createOffer()");
    var me = this;
    try {
        if (this.peerConnection == null) {
            this.createPeerConnection();
        }
        function create(stream) {
            if (hasVideo){
                me.localAudioVideoStream = stream;
            } else {
                me.localAudioStream = stream;
            }
            me.peerConnection.addStream(stream);
            me.setMySdpFn = setMySdpFn;
            me.peerConnection.createOffer(function (offer) {
                me.onCreateOfferSuccessCallback(offer);
            }, function (error) {
                me.onCreateOfferErrorCallback(error);
            }, {"optional": [], "mandatory": {"OfferToReceiveAudio": hasAudio, "OfferToReceiveVideo": hasVideo}});
        }

        if (hasVideo && me.localAudioVideoStream){
                create(me.localAudioVideoStream);
        }else if (!hasVideo && me.localAudioStream){
            create(me.localAudioStream);
        }else{
            getUserMedia({audio: hasAudio, video: hasVideo}, create, function (error) {
                addLogMessage("Failed to get access to local media. Error code was " + error.code + ".");
            });
        }
    }
    catch (exception) {
        console.error("WebRtcMediaManager:createOffer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.createAnswer = function (answerCallFn, hasAudio, hasVideo) {
    console.debug("WebRtcMediaManager:createAnswer()");
    var me = this;
    try {
        if (this.peerConnection == null) {
            this.createPeerConnection();
        }
        function create(stream) {
            me.peerConnection.addStream(stream);
            me.answerCallFn = answerCallFn;
            var sdpOffer = new RTCSessionDescription({
                type: 'offer',
                sdp: me.lastReceivedSdp
            });
            console.debug("WebRtcMediaManager:setRemoteSDP: offer=" + JSON.stringify(sdpOffer));
            me.peerConnectionState = 'offer-received';
            me.peerConnection.setRemoteDescription(sdpOffer, function () {
                me.onSetRemoteDescriptionSuccessCallback();
            }, function (error) {
                me.onSetRemoteDescriptionErrorCallback(error);
            });
        }
        if (hasVideo && me.localAudioVideoStream){
            create(me.localAudioVideoStream);
        }else if (!hasVideo && me.localAudioStream){
            create(me.localAudioStream);
        }else{
            getUserMedia({audio: hasAudio, video: hasVideo}, create, function (error) {
                addLogMessage("Failed to get access to local media. Error code was " + error.code + ".");
            });
        }
    }
    catch (exception) {
        console.error("MobicentsWebRTCPhone:createAnswer(): catched exception:" + exception);
    }
};

WebRtcMediaManager.prototype.onCreateOfferSuccessCallback = function (offer) {
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'new') {
            var application = this;
            this.peerConnectionState = 'preparing-offer';

            this.peerConnection.setLocalDescription(offer, function () {
                application.onSetLocalDescriptionSuccessCallback(offer.sdp);
            }, function (error) {
                application.onSetLocalDescriptionErrorCallback(error);
            });
        }
        else {
            console.error("WebRtcMediaManager:onCreateOfferSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateOfferSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};

WebRtcMediaManager.prototype.onSetLocalDescriptionSuccessCallback = function (sdp) {
    if (webrtcDetectedBrowser == "firefox") {
        console.debug("WebRtcMediaManager:onSetLocalDescriptionSuccessCallback: sdp=" + sdp);
        if (this.peerConnectionState == 'preparing-offer') {
            this.peerConnectionState = 'offer-sent';
            this.setMySdpFn(sdp);// + this.candidates);
        }
        else if (this.peerConnectionState == 'preparing-answer') {
            this.peerConnectionState = 'established';
            this.answerCallFn(sdp);// + this.candidates);
        }
    }
};

WebRtcMediaManager.prototype.getConnectionState = function () {
    return this.peerConnectionState;
};

WebRtcMediaManager.prototype.setRemoteSDP = function (call, sdp, isInitiator) {
    console.debug("WebRtcMediaManager:setRemoteSDP()");
    this.call = call;
    console.debug("WebRtcMediaManager:setRemoteSDP: answer=" + JSON.stringify(sdpAnswer));
    if (isInitiator) {
        var sdpAnswer = new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
        });
        var application = this;
        this.peerConnectionState = 'answer-received';
        this.peerConnection.setRemoteDescription(sdpAnswer, function () {
            application.onSetRemoteDescriptionSuccessCallback();
        }, function (error) {
            application.onSetRemoteDescriptionErrorCallback(error);
        });
    } else {
        this.lastReceivedSdp = sdp;
    }
};

WebRtcMediaManager.prototype.onSetRemoteDescriptionSuccessCallback = function () {
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'answer-received') {
            this.peerConnectionState = 'established';
        }
        else if (this.peerConnectionState == 'offer-received') {
            var application = this;
            this.peerConnection.createAnswer(function (answer) {
                application.onCreateAnswerSuccessCallback(answer);
            }, function (error) {
                application.onCreateAnswerErrorCallback(error);
            }, {'mandatory': {'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true }});
        }
        else {
            console.log("MobicentsWebRTCPhone:onSetRemoteDescriptionSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onSetRemoteDescriptionSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaManager.prototype.onCreateAnswerSuccessCallback = function (answer) {
    if (this.peerConnection != null) {
        if (this.peerConnectionState == 'offer-received') {
            // Prepare answer.
            var application = this;
            this.peerConnectionState = 'preparing-answer';
            this.peerConnection.setLocalDescription(answer, function () {
                application.onSetLocalDescriptionSuccessCallback(answer.sdp);
            }, function (error) {
                application.onSetLocalDescriptionErrorCallback(error);
            });
        }
        else {
            console.log("MobicentsWebRTCPhone:onCreateAnswerSuccessCallback(): RTCPeerConnection bad state!");
        }
    }
    else {
        console.warn("SimpleWebRtcSipPhone:onCreateAnswerSuccessCallback(): this.peerConnection is null, bug in state machine!");
    }
};


WebRtcMediaManager.prototype.onCreateAnswerErrorCallback = function (error) {
    console.error("WebRtcMediaManager:onCreateAnswerErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onCreateOfferErrorCallback = function (error) {
    console.error("WebRtcMediaManager:onCreateOfferErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onSetLocalDescriptionErrorCallback = function (error) {
    console.error("WebRtcMediaManager:onSetLocalDescriptionErrorCallback(): error: " + error);
};
WebRtcMediaManager.prototype.onSetRemoteDescriptionErrorCallback = function (error) {
    console.error("WebRtcMediaManager:onSetRemoteDescriptionErrorCallback(): error: " + error);
};
