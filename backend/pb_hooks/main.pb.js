// PocketBase hooks for expense tracker

// Auto-categorize transactions based on rules when created/updated
onRecordAfterCreateRequest((e) => {
    if (e.collection.name === "transactions") {
        autoCategorizeTransaction(e.record);
    }
}, "transactions");

onRecordAfterUpdateRequest((e) => {
    if (e.collection.name === "transactions") {
        autoCategorizeTransaction(e.record);
    }
}, "transactions");

function autoCategorizeTransaction(record) {
    if (record.get("category_id")) {
        return; // Already has category
    }

    const userId = record.get("user_id");
    const merchant = record.get("merchant") || "";
    const transactionDate = record.get("date");
    
    // Find matching category rules
    const rules = $app.dao().findRecordsByFilter(
        "category_rules",
        "user_id = {:userId} && (start_date = '' || start_date <= {:date}) && (end_date = '' || end_date >= {:date})",
        "-priority",
        500,
        0,
        {
            "userId": userId,
            "date": transactionDate
        }
    );

    for (let rule of rules) {
        const pattern = rule.get("merchant_pattern").toLowerCase();
        if (merchant.toLowerCase().includes(pattern)) {
            record.set("category_id", rule.get("category_id"));
            $app.dao().saveRecord(record);
            break;
        }
    }
}

// Validate unique transaction hashes
onRecordBeforeCreateRequest((e) => {
    if (e.collection.name === "transactions") {
        const hash = e.record.get("hash");
        if (hash && hash !== "") {
            const existing = $app.dao().findFirstRecordByFilter(
                "transactions", 
                "hash = {:hash}",
                { "hash": hash }
            );
            if (existing) {
                throw new BadRequestError("Transaction already exists", {
                    "hash": "Duplicate transaction hash"
                });
            }
        }
    }
}, "transactions");

// Update file upload transaction count
onRecordAfterCreateRequest((e) => {
    if (e.collection.name === "transactions") {
        const fileHash = e.record.get("hash");
        if (fileHash && fileHash.startsWith("file_")) {
            const fileId = fileHash.replace("file_", "").split("_")[0];
            try {
                const fileRecord = $app.dao().findRecordById("file_uploads", fileId);
                const currentCount = fileRecord.get("transactions_count") || 0;
                fileRecord.set("transactions_count", currentCount + 1);
                $app.dao().saveRecord(fileRecord);
            } catch (e) {
                console.log("Could not update file upload count:", e);
            }
        }
    }
}, "transactions");