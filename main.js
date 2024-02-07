const express = require("express")
const crypto = require("crypto")
const app = express();
const fs = require('fs');
let server_port;
serber_port = 8000
let config;
// JSONファイルのパス
const configjson = './config.json';
// databaseをグローバルで定義
let database;
database = {}
// apiのエラーは4XXのステータスを出した上で
//{"id":0,"message":"メッセージ"}
// とする
try {
    // ファイルを同期的に読み込む
    config = JSON.parse(fs.readFileSync(configjson, 'utf8'));
    console.log("config.jsonを読み込みました");
  } catch (err) {
    console.error('config.jsonを読み込めませんでした:', err);
  }
server_port = config.port
try {
    // ファイルを同期的に読み込む
    database = JSON.parse(fs.readFileSync("database.json", 'utf8'));
    console.log("database.jsonを読み込みました");
  } catch (err) {
    console.error('database.jsonを読み込めませんでした:', err);
  }

function writedatabase(keys, value) {
    if (!keys || keys.length === 0) {
      return;
    }
    let currentObject = database;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!currentObject.hasOwnProperty(key) || typeof currentObject[key] !== 'object') {
            // キーが存在しないか、オブジェクトでない場合、新しいオブジェクトを作成
            currentObject[key] = {};
        }
        currentObject = currentObject[key];
    }
    // 最後のキーに対して値を設定
    currentObject[keys[keys.length - 1]] = value;
    const jsonData = JSON.stringify(database, null, 2);
    filePath = "database.json"
    fs.writeFile(filePath, jsonData, 'utf8', (err) => {
        if (err) {
            console.error('error:database.jsonファイルを保存できませんでした:', err);
        } else {
            console.log('ファイルが保存されました:', filePath);
        }
    });
}
//writedatabase(['a', 'i', 'u'], 'e')でdatabase.a.i.uがeになる;
console.log(database);

app.get('/getmangainfo', (req, res) => {
    // クエリパラメータから漫画の情報を取得
    // id:漫画のID
    // token:認証
    // jisho.hasOwnProperty(key)で変数jishoに鍵keyがあるか調べられる
    // が、!hensuu でhensuuの値が有効かどうか判別できる、その逆は!!hensuu
    const id = req.query.id;
    const token = req.query.token;
    let tokeninfo = undefined
    if (!!token){
        tokeninfo = database.token[token];
    }
    if (!id) {
        return res.status(400).send({"id":0,"message":"漫画IDが指定されていません"});
    }
    if (!database.manga.hasOwnProperty(id)) {
        return res.status(404).send({"id":1,"message":"そんなIDの漫画はありません"});
    }
    if (!token && database.manga[id].level != 0) {
        return res.status(401).send({"id":2,"message":"Tokenがない状態で権限レベルが1以上の情報にアクセスしようとしています"});
    }
    if (!!token && tokeninfo.level <= database.manga[id].level){
        return res.status(403).send({"id":3,"message":"権限レベルが足りません"})
    }
    res.send(database.manga[id])
});

app.get('/apiinfo', (req, res) => {
    res.send(database.info);
});

app.get('/login', (req, res) => {
    // ログイン
    // id:ログインしたいアカウントのID
    // password:パスワード
    const id = req.query.id;
    const password = req.query.password;
    if (!id){
        return res.status(400).send({"id":0,"message":"IDが指定されていません"});
    }
    if (!password){
        return res.status(400).send({"id":1,"message":"パスワードが指定されていません"});
    }
    if (!database.OAuth.hasOwnProperty(id)){
        return res.status(403).send({"id":2,"message":"ユーザーIDまたはパスワードが違います"})
    }
    if (database.OAuth[id].password != password){
        return res.status(403).send({"id":2,"message":"ユーザーIDまたはパスワードが違います"})
    }
    let Token = crypto.randomUUID(); // TokenはUUID
    while (Token in database.token){
        Token = crypto.randomUUID(); // TokenはUUID
    }
    writedatabase(["token",Token,"level"],database.user[id].level)
    writedatabase(["token",Token,"user"],id)
    res.send(token)
});

app.get('/getmanga', (req, res) => {
    // クエリパラメータから漫画(画像ファイル)を取得
    // id:漫画のID
    // token:認証
    // page:ページ数
    const id = req.query.id;
    const token = req.query.token;
    const page = req.query.page;
    let tokeninfo = undefined
    if (!!token){
        tokeninfo = database.token[token];
    }
    if (!id) {
        return res.status(400).send({"id":0,"message":"漫画IDが指定されていません"});
    }
    if (!page) {
        return res.status(400).send({"id":4,"message":"ページ数が指定されていません"}); // getmangainfoとエラーがほぼ同じなので、idは後に追加する感じ
    }
    if (!database.manga.hasOwnProperty(id)) {
        return res.status(404).send({"id":1,"message":"そんなIDの漫画はありません"});
    }
    if (!token && database.manga[id].viewlevel != 0) {
        return res.status(401).send({"id":2,"message":"Tokenがない状態で権限レベルが1以上の情報にアクセスしようとしています"});
    }
    if (!!token && tokeninfo.level <= database.manga[id].viewlevel){
        return res.status(403).send({"id":3,"message":"権限レベルが足りません"})
    }
    // ファイルパスを設定
    // pngファイルであること前提
    // manga/漫画のID/ページ数.png
    const fileName = "./manga/" + id + "/" + page + ".png";
    // ファイルのパスを構築
    const filePath = path.join(__dirname, 'files', fileName);
    // ファイルが存在するか確認
    fs.access(filePath, fs.constants.R_OK, (err) => {
        if (err) {
        return res.status(404).send('指定されたファイルが見つかりません。');
        }

        // ファイルを読み取り、レスポンスとして送信
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

// 404
app.all("*", (req, res) => {
    res.status(404).send("そんなAPIはありません")
  })

const server = app.listen(server_port, function(){
    console.log("このプログラムは" + server.address().port + "番ポートで動いています");
});