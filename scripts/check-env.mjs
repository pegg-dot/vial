const required=["DATABASE_URL","VIAL_SESSION_SECRET","VIAL_PRIVACY_HASH_SECRET","NEXT_PUBLIC_SITE_URL"];
const missing=required.filter(key=>!process.env[key]?.trim());
if(missing.length){console.error(`Missing required production variables: ${missing.join(", ")}`);process.exit(1)}
for(const key of ["VIAL_SESSION_SECRET","VIAL_PRIVACY_HASH_SECRET"])if(process.env[key].length<32){console.error(`${key} must be at least 32 characters`);process.exit(1)}
try{new URL(process.env.NEXT_PUBLIC_SITE_URL)}catch{console.error("NEXT_PUBLIC_SITE_URL must be a valid URL");process.exit(1)}
console.log("Production environment contract is complete.");
