nw.Window.open('form1.html', {}, function (win) {
    clientWindowFormat(win);
    win.moveTo(50, 50);
});
nw.Window.open('form1.html', {}, function (win) {
    clientWindowFormat(win);
    win.moveTo(50, 450);
});
clientWindowFormat = (win) => {
    win.resizeTo(600, 400);
}
nw.Window.open('form2.html', {}, function (win) {
    win.resizeTo(300, 700);
    win.moveTo(700, 50);
});