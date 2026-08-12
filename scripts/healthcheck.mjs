const base=process.env.VIALGRADE_HEALTHCHECK_URL||"http://127.0.0.1:3000";
for(const path of ["/api/health/live","/api/health/ready"]){const response=await fetch(`${base}${path}`,{redirect:"manual"});if(response.status!==200){console.error(`${path} returned ${response.status}: ${await response.text()}`);process.exit(1)}console.log(`${path}: ${response.status}`)}
