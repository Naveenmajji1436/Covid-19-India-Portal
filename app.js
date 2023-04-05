const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app = express();
app.use(express.json());
let db = null;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const installServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log(`Server Start...`);
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};
installServer();

const convertingStates = (eachDetail) => {
  return {
    stateId: eachDetail.state_id,
    stateName: eachDetail.state_name,
    population: eachDetail.population,
  };
};

const convertingDistricts = (eachDetail) => {
  return {
    districtId: eachDetail.district_id,
    districtName: eachDetail.district_name,
    stateId: eachDetail.state_id,
    cases: eachDetail.cases,
    cured: eachDetail.cured,
    active: eachDetail.active,
    deaths: eachDetail.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

/// GET STATES 1
app.get("/states/", authenticateToken, async (request, response) => {
  const SqlStatesGetQuery = `
    SELECT *
    FROM state;`;
  let statesList = await db.all(SqlStatesGetQuery);
  response.send(statesList.map((eachDetail) => convertingStates(eachDetail)));
});

/// GET STATE 2
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const SqlStateQuery = `
    SELECT *
    FROM state
    WHERE state_id = ${stateId};`;
  let oneState = await db.get(SqlStateQuery);
  response.send(convertingStates(oneState));
});

/// POST DISTRICTS 3
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const SqlPostQuery = `
    INSERT INTO district
    (district_name,state_id,cases,cured,active,deaths)
    VALUES ("${districtName}",${stateId},${cases},${cured},${active},${deaths});
    `;
  let districtPost = await db.run(SqlPostQuery);
  let districtId = districtPost.lastID;
  response.send(`District Successfully Added`);
});

/// GET DISTRICT 4
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const SqlDistrictQuery = `
    SELECT *
    FROM district
    WHERE district_id = ${districtId};`;
    let oneDistrict = await db.get(SqlDistrictQuery);
    response.send(convertingDistricts(oneDistrict));
  }
);

/// DELETE DISTRICT 5
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const SqlDeleteQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId}`;
    await db.run(SqlDeleteQuery);
    response.send(`District Removed`);
  }
);

/// UPDATE DISTRICT 6
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const SqlUpdateQuery = `
    UPDATE district
    SET
    district_name = "${districtName}",
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    await db.run(SqlUpdateQuery);
    response.send(`District Details Updated`);
  }
);

/// GET STATE STATS 7
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const SqlStatsQuery = `
    SELECT 
    sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
    FROM state NATURAL JOIN district
    WHERE state_id = ${stateId};`;
    let stateStats = await db.get(SqlStatsQuery);
    response.send(stateStats);
  }
);

/// GET DISTRICT
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    let SqlStateSearch = `
  SELECT state_name as stateName
  FROM state INNER JOIN district
  ON state.state_id = district.state_id
  WHERE district_id = ${districtId};`;
    let searching = await db.get(SqlStateSearch);
    response.send(searching);
  }
);

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

module.exports = app;
