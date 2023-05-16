
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const express = require('express');
const cors = require('cors');
const app = express();




app.use(cors({ origin: '*' }));



// const server = require('http').createServer(app);
const io = require('socket.io')(8080,{
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
    sex: String
  }, { versionKey: false });
  
  const User = mongoose.model('User', userSchema, 'Users');




io.on('connection', (socket) => {
  socket.on('message', (request) => {
    const gender = request.gender;
    const sexuality = request.sexuality;
    let last_post_ids = [];

    const intervalFunction = async () => {
      let query = {};
      if (sexuality === 'Heterosexual') {
        query.sex = gender === 'Masculino' ? 'Femenino' : 'Masculino';
        query.gustos = 'Heterosexual';
      } else if (sexuality === 'Bisexual') {
        query.gustos = 'Bisexual';
      } else if (sexuality === 'Gay') {
        query.sex = gender;
        query.gustos = 'Gay';
      }

      const posts = await User.find(query);
      const post_ids = posts.map(post => post['_id']);
      if (post_ids.length != last_post_ids.length) {
        const filtered_posts = posts.filter(post => !last_post_ids.includes(post['_id']));
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
                    email: userDocument.email,
                    user: userDocument.user,
                    name: userDocument.name,
                    sex: userDocument.sex,
                    gustos: userDocument.gustos
         
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
                email: newUser.email,
                user: newUser.user,
                name: newUser.name,
                sex: newUser.sex,
                gustos: newUser.gustos
                // ...
            };
            res.json({ mensaje: 'Registro exitoso', register: true, data: userData });
        }
    } catch (err) {
        res.json({ mensaje: 'Registro falló', register: false });
    }
});


  

app.listen(8000, () => {
  console.log('Servidor escuchando en el puerto 8000');
});

