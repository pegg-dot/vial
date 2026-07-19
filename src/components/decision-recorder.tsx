"use client";
import { useEffect } from "react";
export function DecisionRecorder({eventType,subjectType,subjectId,metadata}:{eventType:"listing_viewed"|"evidence_opened";subjectType:"listing"|"compound"|"vendor";subjectId:string;metadata?:Record<string,unknown>}){useEffect(()=>{void fetch("/api/v1/decision-events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventType,subjectType,subjectId,metadata})})},[eventType,subjectId,subjectType,metadata]);return null}
