const connection = {};
if (!connection['hello']) {
    connection['hello'] = {};
}
connection['hello']['world'] = {
    app: 'hello'
};

console.log(connection);