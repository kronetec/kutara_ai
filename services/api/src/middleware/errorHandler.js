export function errorHandler(err,req,res,n){console.error("Error:",err);res.status(500).json({ok:false,error:process.env.NODE_ENV==="production"?"Internal error":err.message});}
