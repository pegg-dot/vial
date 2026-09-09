const required=["DATABASE_URL","VIALGRADE_SESSION_SECRET","VIALGRADE_PRIVACY_HASH_SECRET","NEXT_PUBLIC_SITE_URL"];
const missing=required.filter(key=>!process.env[key]?.trim());
if(missing.length){console.error(`Missing required production variables: ${missing.join(", ")}`);process.exit(1)}
for(const key of ["VIALGRADE_SESSION_SECRET","VIALGRADE_PRIVACY_HASH_SECRET"])if(process.env[key].length<32){console.error(`${key} must be at least 32 characters`);process.exit(1)}
if(process.env.VIALGRADE_SESSION_SECRET===process.env.VIALGRADE_PRIVACY_HASH_SECRET){console.error("VIALGRADE_SESSION_SECRET and VIALGRADE_PRIVACY_HASH_SECRET must be independent values");process.exit(1)}
let site;
try{site=new URL(process.env.NEXT_PUBLIC_SITE_URL)}catch{console.error("NEXT_PUBLIC_SITE_URL must be a valid URL");process.exit(1)}
if(site.protocol!=="https:"){console.error("NEXT_PUBLIC_SITE_URL must use https in a deployed production environment");process.exit(1)}
console.log("Production environment contract is complete.");
