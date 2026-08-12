process.env.VIALGRADE_PGLITE_MEMORY="true";
process.env.VIALGRADE_SEED_FIXTURES="true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS="true";
process.env.VIALGRADE_SESSION_SECRET="consumer-audit-session-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET="consumer-audit-privacy-secret-at-least-32-characters";
const {getDatabase,resetDatabaseForTests}=await import("../src/server/db/client.ts");
const {getPersonalizedMarket}=await import("../src/server/consumer-intelligence/service.ts");
const {getConsumerIntelligenceDashboard,getDefaultComparison,getConsumerPreferences,listSavedSearches,listFollows,listUserNotifications}=await import("../src/server/consumer-intelligence/repository.ts");
try{
 await resetDatabaseForTests();const db=await getDatabase();const version=Number((await db.query(`SELECT MAX(version) version FROM schema_migrations`)).rows[0]?.version??0);if(version<5)throw new Error(`Expected schema version 5, got ${version}`);
 const user="user:customer:nora";const [market,dashboard,comparison,preferences,searches,follows,notifications]=await Promise.all([getPersonalizedMarket(user),getConsumerIntelligenceDashboard(),getDefaultComparison(user),getConsumerPreferences(user),listSavedSearches(user),listFollows(user),listUserNotifications(user,{limit:100})]);
 const failures=[];if(!market.recommendations.length)failures.push("No personalized recommendations");if(market.recommendations.some(item=>!item.reasons.length))failures.push("Recommendation missing explanation");if(!comparison||comparison.listingSlugs.length<2)failures.push("Default comparison not durable");if(!preferences.personalizationEnabled)failures.push("Personalization preference missing");if(searches.length<2)failures.push("Saved searches not seeded");if(follows.length<2)failures.push("Entity follows not seeded");if(!notifications.length)failures.push("Relevance-ranked notifications missing");if(dashboard.personalizedUsers<1||dashboard.savedSearches<2||dashboard.comparisons<1)failures.push("Consumer dashboard counts are incomplete");if(failures.length)throw new Error(failures.join("\n"));console.log(`Consumer intelligence audit passed: ${market.recommendations.length} ranked records, ${searches.length} saved searches, ${follows.length} follows, ${notifications.length} visible notifications.`);
}finally{await resetDatabaseForTests()}
