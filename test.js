const {detectAvailableShells} = require('./lib/cjs');

detectAvailableShells().then((shells)=>{
    console.log(shells);
})