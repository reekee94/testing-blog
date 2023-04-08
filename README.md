##### SETUP

------------
    
    - `npm install`

    in src/config.ts set JsonWebToken secret key and port if needed

    
----------

##### AND SETUP DB

----------

Create a new  database with the name `nestblog`\
(or the name you specified in the ormconfig.json)
    
Set mysql database settings in ormconfig.json

    {
      "type": "postgres",
      "host": "localhost",
      "port": 45432,
      "username": "user",
      "password": "pwd",
      "database": "nestjsblog",
      "entities": ["src/**/**.entity{.ts,.js}"],
      "synchronize": true
    }
    
Start local db server and create new database 'nestjsblog'

On application start, tables for all entities will be created.

----------

## Start application

- `npm start`
- Test api with `http://localhost:3000/api/articles`

----------