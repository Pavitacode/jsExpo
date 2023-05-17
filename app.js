
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const express = require('express');
const cors = require('cors');
const app = express();

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('tinderclonestorage');


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
      const id = request.id;
      const gender = request.gender;
      const sexuality = request.sexuality;
      console.log(gender + sexuality);
      let last_post_ids = [];
      let query = {
        _id: { $ne: id },
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
                id: newUser._id,
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


app.put('/update/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  try {
    if (updateData.isPasswordChanged) {
      const user = await User.findById(id);
      const passwordMatch = await bcrypt.compare(updateData.lastPassword, user.password);
      if (passwordMatch) {
        const hashedPassword = await bcrypt.hash(updateData.newPassword, 10);
        updateData.password = hashedPassword;
      } else {
        return res.status(400).json({ message: 'La contraseña anterior no coincide' });
      }
    }
    delete updateData.isPasswordChanged;
    delete updateData.lastPassword;
    delete updateData.newPassword;

    // Subir imágenes a Google Cloud Storage
    if (updateData.imageBuffer && Array.isArray(updateData.images)) {
      // Consultar el campo de imágenes del usuario en la base de datos
      const user = await User.findById(id);
      if (!user.images || user.images.length < 5) {
        for (let i = 0; i < updateData.images.length; i++) {
          if (i >= 5) break; // Limitar a un máximo de 5 imágenes

          const imageId = `${id}_${i + 1}`;
          const file = bucket.file(`${imageId}.png`);

          // Eliminar imagen anterior si se está editando una imagen específica
          if (updateData.imageIndex === i) {
            await file.delete();
          }

          const stream = file.createWriteStream({
            metadata: {
              contentType: 'image/png'
            }
          });

          stream.on('error', (err) => {
            console.error(err);
          });

          stream.on('finish', () => {
            console.log(`Archivo ${i} subido con éxito`);
          });

          stream.end(updateData.images[i]);
        }

        // Actualizar el campo de imágenes del usuario en la base de datos
        user.images = updateData.images.map((image, index) => `https://storage.googleapis.com/tinderclonestorage/${id}_${index + 1}.png`);
        await user.save();
      } else {
        return res.status(400).json({ message: 'Ya has alcanzado el límite máximo de 5 imágenes' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });
    const data = {
      id: updatedUser._id,
      email: updatedUser.email,
      user: updatedUser.user,
      name: updatedUser.name,
      sex: updatedUser.sex,
      gustos: updatedUser.gustos
    };
    res.json({ message: 'Usuario actualizado con éxito', data });
  } catch (err) {
    res.status(500).json({ message: 'Error al actualizar el usuario' });
  }
});



app.listen(8000, () => {
  console.log('Servidor escuchando en el puerto 8000');
});

