I want to use the vercel site as a presentation for a technical presentation for a 1 hour sesison for RAG and Vectorless RAG 

Step 1 : RAG Ingestion

Example document 

The data is present in the location /Users/srinivaschakrapani/Downloads/dm_spl_monthly_update_jul2026, this is a monthly med data downloaded  from https://dailymed.nlm.nih.gov/dailymed/spl-resources-all-drug-labels.cfm

defining the RAG Chunking and disecting each and ewvery step and providing visually as to what happens in that step 

The chunks can be stored in the FAISS db within the session , dont want a dedicated db as such , a new tab shoul dbe added to idneity how the chunkking looks like it shuld be intuitive and should exmpalinfrom dfundamentals to depth withn interative and relatable examples

chunking can be done via docling 

embedding algorithm can be the one provided by FAISS ensure to use a free hosting paln for the same , dont ewant to incur any cost here 

The brain is the Gemma 4 2B model by google , it can be sourced via the Hugging face free plan or the modal plan , the keys are added in the .env.local

Vectopred RAG 
A tab that provides the details of each step of RAG for a given question provide some sample questions 

Vectorless RAG 
Here the knowledge prepartaion step shlould be structured , detail steps to be provided how the graph is build from the raw data supplied 

Provide some scenarios and steps as to how the reposne is genearted 

thrid tab is the compariosn between the vectored and the vectorless graphs , provide some edge cases where in the RAG gives the wrong answer and the vectorless rag gives the right answer 

plan the wholething first and then provide with the estimaetd cost /btw make the chnages compile it and open a local end poiont to test 