class ApiFeatures {
    constructor(query, queryString, modelName) {
        this.query = query;
        this.queryString = queryString;
        this.modelName = modelName;
        this.paginationResult = null;
    }

    search() {
        const keyword = this.queryString.search;
        if (!keyword) return this;
        // search fields for each model
        const searchFields = {
            User: ["firstName","lastName","email","phone"],
            Message: ["content"],
            Doctor: ["fullName","email"],
            Notification: ["body"],
            Hospital: ["hospitalName"],
        };

        const fields = searchFields[this.modelName];
        if (!fields) return this;

        // search on any field
        const orConditions = fields.map((field) => ({
            [field]: { $regex: keyword, $options: "i" }
        }));

        this.query = this.query.find({ $or: orConditions });

        return this;
    }

    filter() {
        const queryObj = { ...this.queryString };

        // remove common fields
        const removeFields = ["search", "page", "limit", "sort", "select"];
        removeFields.forEach((key) => delete queryObj[key]);

        // Handle date range safely
        if (queryObj.startDate || queryObj.endDate) {
            queryObj.createdAt = {};
            if (queryObj.startDate) {
                const start = new Date(queryObj.startDate);
                if (!isNaN(start)) queryObj.createdAt.$gte = start;
                delete queryObj.startDate;
            }
            if (queryObj.endDate) {
                const end = new Date(queryObj.endDate);
                if (!isNaN(end)) queryObj.createdAt.$lte = end;
                delete queryObj.endDate;
            }
            if (Object.keys(queryObj.createdAt).length === 0) delete queryObj.createdAt;
        }

        // Convert operators like gt, gte, lt, lte ONLY for non-date fields
        const operators = ["gt", "gte", "lt", "lte"];
        for (const key in queryObj) {
            if (!queryObj[key] || typeof queryObj[key] !== "object") continue;
            for (const op of operators) {
                if (queryObj[key][op] !== undefined) {
                    queryObj[key]["$" + op] = queryObj[key][op];
                    delete queryObj[key][op];
                }
            }
        }

        this.query = this.query.find(queryObj);

        return this;
    }

    sort() {
        if (this.queryString.sort) {
            const sortType = this.queryString.sort;

            if (sortType === "latest") {
                this.query = this.query.sort({ createdAt: -1 }); // newest first
            } else if (sortType === "oldest") {
                this.query = this.query.sort({ createdAt: 1 }); // oldest first
            }
        } else {
            this.query = this.query.sort({ createdAt: -1 });
        }

        return this;
    }

    paginate() {
        const page = this.queryString.page ? Number(this.queryString.page) : 1;
        const limit = this.queryString.limit ? Number(this.queryString.limit) : 20;
        const skip = (page - 1) * limit;

        this.query = this.query.skip(skip).limit(limit);

        return this;
    }

    cleanResponse() {
        const staticFields = ["updatedAt", "__v"];
        const fieldsToExclude = staticFields.map(field => `-${field}`);
        this.query = this.query.select(fieldsToExclude.join(" "));
        return this;
    }

    async calculatePagination() {
        // Count total documents for current query
        const totalDocs = await this.query.clone().countDocuments();
        
        // Determine current page and limit from query string, default values if not provided
        const page = this.queryString.page ? Number(this.queryString.page) : 1;
        const limit = this.queryString.limit ? Number(this.queryString.limit) : 20;

        // Calculate total pages
        const totalPages = Math.ceil(totalDocs / limit);

        // Save pagination info to be used in response
        this.paginationResult = {
            currentPage: page,         
            limit: limit,              
            totalPages: totalPages,    
            totalResults: totalDocs,     // total number of documents
            hasNextPage: page < totalPages, // is there a next page
            hasPrevPage: page > 1      // is there a previous page
        };

        return this; // allow chaining
    }

}

module.exports = ApiFeatures;