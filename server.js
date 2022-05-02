const http = require('http').createServer(),
    io = require('socket.io')

const host = '127.0.0.1'
const port = 3030
server = new io.Server(http);
module.exports = server;

let clients = []
let retranslateEventList = ['offer', 'answer', 'icecandidate', 'rtcstatus', 'rtcmessageprepare'];

server.on('connection', (socket) => {
    console.warn(`Client with id ${socket.id} connected`)
    clients.push(socket);

    socket.on('start', () => {
            console.warn('Server Start: ', socket.id);
            socket.emit("start", socket.id);
        }
    );
    retranslateEventList.forEach((event) => {
        socket.on(event, (message) => {
            _retranslate(socket, event, message);
        });
    });


    socket.on('disconnect', () => {
        console.warn(`Server Client with id ${socket.id} disconnected`);
        clients.splice(clients.indexOf(socket.id), 1);
    })
})

function _retranslate(socket, event, message) {
    if(clients.length <= 1) return false;
    let resp_socket = clients[1 - clients.indexOf(socket)];
    if(event.localeCompare("rtcmessageprepare") === 0) resp_socket.once(message.messID, () => _retranslate(resp_socket, message.messID, message));
    resp_socket.emit(event, message);
    console.warn(`${event} received from ${socket.id} and retranslated to ${resp_socket.id}`);
    return true;
}

http.listen(port, host, () =>
    console.warn(`Server listens http://${host}:${port}`)
)