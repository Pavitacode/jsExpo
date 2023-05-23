const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const express = require('express');
const cors = require('cors');
const app = express();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const server = require('http').createServer(app);



const { Storage } = require('@google-cloud/storage');
let projectId = 'insidethenetworl';
let keyFilename = "mykey.json";
const storage = new Storage({
  projectId,
  keyFilename,
});
const bucket = storage.bucket('tinderclonestorage');

app.use(cors({ origin: '*' }));

const io = require('socket.io')(server,{
 cors:{
 origin: "*"
 }
});
// El resto del código del servidor

mongoose.connect('mongodb+srv://pavita:Jacobo9384@cluster0.vnuk7fw.mongodb.net/TinderClone?retryWrites=true&w=majority', {
 useNewUrlParser: true,
 useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
 user: String,
 password: String,
 name: String,
 email: String,
 gustos: String,
 likesYou: [],
 likes: [],
 dislikes: [],
 sex: String,
 profilePicture: String,
 }, { versionKey: false });
 
 const User = mongoose.model('User', userSchema, 'Users');


io.on('connection', (socket) => {


    
 socket.on('likeUsers', async (request) => {
    const  id  = request.id;
    console.log(id)
    console.log("hola1")
    let last_likes_ids = [];
    const intervalFunction = async () => {
      const user = await User.findById(id);
      const likesYou = user.likesYou;
      if (likes.length != last_likes_ids.length) {
        console.log("hola2")
        const new_likes = likesYou.filter((like) => !last_likes_ids.includes(like));
        const liked_users = await User.find({ _id: { $in: new_likes } });
        socket.emit('likeUsers', liked_users);
        last_likes_ids = likesYou;
      }
    };
    setInterval(intervalFunction, 1000);
  });


 socket.on('message', async (request) => {
 const id = request.id;
 const gender = request.gender;
 const user = await User.findById(id);
 const likes = user.likes
 const dislikes = user.dislikes
 const sexuality = request.sexuality;
 console.log(gender + sexuality);
 let last_post_ids = [];
 let query = {
    _id: { $ne: id, $nin: [...likes, ...dislikes] },
  };
 if (sexuality === 'Heterosexual') {
 query.sex = gender === 'Masculino' ? 'Femenino' : 'Masculino';
 query.gustos = 'Heterosexual';
 } else if (sexuality === 'Bisexual') {
 query.gustos = 'Bisexual';
 } else if (sexuality === 'Gay') {
 query.sex = gender;
 query.gustos = 'Gay';
 }
 
 console.log(query);
 const intervalFunction = async () => {
 const posts = await User.find(query);
 const post_ids = posts.map((post) => post['_id'].toString());
 if (post_ids.length != last_post_ids.length) {
 const filtered_posts = posts.filter(
 (post) => !last_post_ids.includes(post['_id'].toString())
 );
 socket.emit('message', filtered_posts);
 last_post_ids = post_ids;
 }
 };
 
 setInterval(intervalFunction, 1000);
 });
 });
 

app.use(express.json()); 

app.post('/Login', async (req, res) => {
 const datosRecibidos = req.body;
 let password = datosRecibidos['password'];
 let user = datosRecibidos['user'];

 try {
 
 const userDocument = await User.findOne({ $or: [{ email: user }, { user: user }] });
 if (userDocument) {
 
 const passwordMatch = await bcrypt.compare(password, userDocument.password);
 if (passwordMatch) {
 
 const userData = {
 id: userDocument._id,
 email: userDocument.email,
 user: userDocument.user,
 name: userDocument.name,
 sex: userDocument.sex,
 gustos: userDocument.gustos,
 image: userDocument.profilePicture
 
 };
 res.json({ mensaje: 'Inicio de sesión correcto', login: true, data: userData });
 } else {
 res.json({ mensaje: 'La contraseña no coincide', errorPassword: true });
 }
 } else {
 res.json({ mensaje: 'El usuario o correo no existen', errorUserLogin: true });
 }
 } catch (error) {
 console.error(error);
 res.status(500).json({ mensaje: 'Error al iniciar sesión', login: false });
 }
});

app.post('/Register', async (req, res) => {
 const datosRecibidos = req.body;
 const { email, user } = datosRecibidos;
 const saltRounds = 10;
 try {
 const existingEmail = await User.findOne({ email });
 const existingUser = await User.findOne({ user });
 if (existingEmail) {
 res.json({ mensaje: 'El correo ya está en uso', errorEmail: true });
 } else if (existingUser) {
 res.json({ mensaje: 'El nombre de usuario ya está en uso', errorUser: true });
 } else {
 const hashedPassword = await bcrypt.hash(datosRecibidos.password, saltRounds);
 const newUser = new User({ ...datosRecibidos, password: hashedPassword });
 await newUser.save();
 
 const userData = {
 id: newUser._id,
 email: newUser.email,
 user: newUser.user,
 name: newUser.name,
 sex: newUser.sex,
 gustos: newUser.gustos,
 image: newUser.profilePicture
 // ...
 };
 res.json({ mensaje: 'Registro exitoso', register: true, data: userData });
 }
 } catch (err) {
 res.json({ mensaje: 'Registro falló', register: false });
 }
});

app.put('/update/:id', upload.single('profilePicture'), async (req, res) => {
    try{
        let updateData=req.body;
        if(updateData.isNewPicture==='true'){
            let file=req.file;
            let fileName=file.originalname.split('.');
            fileName=fileName[0]+Date.now()+'.'+fileName[1];
            await bucket.upload(file.path,{destination:'profilePictures/'+fileName});
            updateData.profilePicture='https://storage.googleapis.com/tinderclonestorage/profilePictures/'+fileName;
            
        }
        delete updateData.isNewPicture;

        if(updateData.isPasswordChanged==='true'){
            let passwordMatch=await bcrypt.compare(updateData.lastPassword,(await User.findById(req.params.id)).password);
            if(passwordMatch){
                updateData.password=await bcrypt.hash(updateData.newPassword,10);
            }else{
                return res.status(400).json({message:'La contraseña anterior no coincide'});
            }
        }
        delete updateData.isPasswordChanged;
        delete updateData.lastPassword;
        delete updateData.newPassword;

      
        let updatedUser=await User.findByIdAndUpdate(req.params.id,updateData,{new:true});
        let data={
            id : updatedUser._id,
            email : updatedUser.email,
            user : updatedUser.user,
            name : updatedUser.name,
            sex : updatedUser.sex,
            gustos : updatedUser.gustos,
            image: updatedUser.profilePicture
        };
        res.json({message:'Usuario actualizado con éxito',data});
    }catch(err){
        console.log(err)
        res.status(500).json({message:'Error al actualizar el usuario'});
    }
});

app.put('/addLikeOrDislike/:id', async (req, res) => {
    try {
    const { id } = req.params;
    const { otherUserId, isLike } = req.body;
    const update = isLike ? { $push: { likes: otherUserId } } : { $push: { dislikes: otherUserId } };
    const updateLikes = await User.findByIdAndUpdate(id, update);
    if (isLike) {
    await User.findByIdAndUpdate(otherUserId, { $push: { likesYou: id } });
    }
    res.json({ message: 'Actualización exitosa', isActualize: updateLikes});
    } catch (err) {
    res.status(500).json({ message: 'Error al actualizar el usuario' });
    }
   });
   
  

server.listen(process.env.PORT || 3000, () => {
 console.log(`Servidor escuchando en el puerto ${process.env.PORT}`);
});
