const socket = require("socket.io-client");
const { randomUUID } = require('crypto');
const EventEmitter = require("events");
module.exports = class RTCClient extends EventEmitter{

    constructor(URL) {
        super();
        this.client = socket(URL);
        this.socketID = "0";
        this.clientID = randomUUID();
        this.remoteRTCstatus = false;
        this.localRTCstatus = false;
        this.socketstatus = "disconnected";
        this.rtc = new RTCPeerConnection();
        this._messagesInfo = [];
        this._receiveBuffers = new Map();
        this._start();
    }

    close(){
        this.rtc.close();
        this.client.close();
    }

    async startRTCConnection(){
        if (this.socketID === "0") return false;
        let offer = await this.rtc.createOffer();
        await this.rtc.setLocalDescription(offer);
        this.client.emit("offer", offer);
        return true;
    }

    async sendMessage(message, offset=0, chunkSize=1000){
        if(this.localRTCstatus !== "connected") return false;
        let messID = randomUUID();
        console.log(`Send message: ${message}`);
        this.client.emit('rtcmessageprepare', {"messID": messID, "len": message.length});
        this.client.once(messID, ()=>{
            this.emit("sendstart", messID);
            let chunkCount = offset/chunkSize;
            while(offset < message.length){
                try {
                    let mapMess = {
                        "messID": messID,
                        "data": message.slice(offset, offset + chunkSize)
                    };
                    this.sendChannel.send(JSON.stringify(mapMess));
                }
                catch(e){
                    this.emit("sendabort", messID, offset);
                    return false;
                }
                chunkCount++;
                offset += chunkSize;
                this.emit("sendpacket", messID, offset);
            }
            this.emit("sendcomplete", messID);
            return true;
        });
    }

    _rtcInit(){
        this.rtc.addEventListener("icecandidate",async (event) => {
            console.log(`ICECandidate event: ${event.candidate}`);
            if(event.candidate) {
                this.client.emit("icecandidate", event.candidate);
            }
        });

        this.rtc.addEventListener("connectionstatechange", (event) => {
            console.error(`Connection ${this.socketID} state: ${this.rtc.connectionState}`);
            this.localRTCstatus = this.rtc.connectionState;
            this.emit("rtc"+this.rtc.connectionState);
        });

        this.sendChannel = this.rtc.createDataChannel('sendDataChannel');
        this.sendChannel.binaryType = 'arraybuffer';
        console.log('Created send data channel');

        this.sendChannel.addEventListener('open', (event) => {});
        this.sendChannel.addEventListener('close', (event) => {});
        this.sendChannel.addEventListener('error', (event) => {});

        this.rtc.addEventListener('datachannel', (event) => {
            console.log(`Receive Channel Callback`);
            let receiveChannel = event.channel;
            receiveChannel.binaryType = 'arraybuffer';
            let receivedSize = 0;

            receiveChannel.onmessage = (event) => {
                let message = JSON.parse(event.data);
                let messID = message.messID;
                let data = message.data;
                let len = data.length;
                let buffer = this._receiveBuffers.get(messID);
                buffer.push(data);
                let receivedSize = buffer.join("").length;
                this.emit('receivepacket', messID, receivedSize);
                if(receivedSize === this._messagesInfo.find(mess => mess.messID === messID).len){
                    console.log(`Receive complete: ${buffer}`);
                    this.emit("receivecomplete", messID, buffer);
                    this._receiveBuffers.delete(messID);
                    this._messagesInfo.splice(this._messagesInfo.indexOf(this._messagesInfo.find(mess => mess.messID === messID)), 1);
                }
            };
            receiveChannel.onopen = (event) => {

            };
            receiveChannel.onclose = (event) => {

            };
        });
    }

    _socketInit(){
        this.client.on("connect", () => {
            this.client.emit("start");
            this.socketstatus = "connect";
            this.emit("socketconnect");
        });
        this.client.on('start', (id) => {
                console.log(`Client ${this.socketID} Start: `, id);
                this.emit("status", "connected");
                this.socketstatus = "connected";
                this.socketID = id;
            }
        );
        this.client.on('offer', async (offer) => {
                console.log(`Client ${this.socketID} Offer: ${offer.sdp}`);
                await this.rtc.setRemoteDescription(new RTCSessionDescription(offer));
                let ans = await this.rtc.createAnswer();
                await this.rtc.setLocalDescription(ans);
                this.client.emit("answer", ans);
            }
        );
        this.client.on('answer', async (answer) => {
                console.log(`Client ${this.socketID} Answer: ${answer.sdp}`);
                await this.rtc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        );
        this.client.on('icecandidate', async (candidate) => {
                console.log(`Client ${this.socketID} Candidate: `, candidate);
                await this.rtc.addIceCandidate(candidate);
            }
        );

        this.client.on('disconnect', () => {
            this.emit("socketdisconnect");
            this.socketstatus = "disconnected";
            console.log(`Client ${this.socketID} Disconnected`);
        });

        this.client.on('rtcstatus', (status) => {
                console.log(`Client ${this.socketID} Remote RTC status: `, status);
                this.remoteRTCstatus = status;
            }
        );

        this.client.on('rtcmessageprepare', (messageInfo) => {
                this._messagesInfo.push(messageInfo);
                this._receiveBuffers.set(messageInfo.messID, []);
                this.client.emit(messageInfo.messID);
                console.log(`Client ${this.socketID} message prepare size: ${messageInfo.len}`);
            }
        );
    }

    _start() {
        this._socketInit();
        this._rtcInit();
    }
}