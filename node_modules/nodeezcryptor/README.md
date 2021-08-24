# nodeezcryptor

## Instalation

### Linux:

Install your OS OpenSSL libraries.   
Ubuntu: `apt install libssl-dev`  

### Windows:

OpenSSL Precompiled libraries & header files are now included in this repo.

## package.json:
    "nodeezcryptor": "git+https://notabug.org/xefglm/nodeezcryptor.git#master"

## Example:

    const decryptor = require('decryptor');

    //Get Key:
    decryptor.getKey("trackID");

    //Decrypt File:
    decryptor.decryptFile("key", "inputFilename", "outputFilename");