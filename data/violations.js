import { violations } from '../config/mongoCollections.js';
import { v4 as uuidv4 } from "uuid";
import { checkId, checkString } from '../helpers.js';

export const getAllViolations = async () => {
    const collection = await violations();
    const all = await collection.find({}).toArray();

    if(!all) throw "Could not get violations";

    return all;
};

export const getViolationById = async (id) => {
    id = checkId(id, "violationId");

    const collection = await violations(); 
    const violation = await collection.findOne({ _id: id });

    if (!violation) throw "Violation not found";

    return violation;
};

export const getViolationsByPropertyId = async (propertyId) => {
    propertyId = checkId(propertyId, "propertyId");

    const collection = await violations();
    const results = await collection.find({propertyId}).toArray();
    return results; 
};

export const createViolation = async (data) => {
    if (!data) throw "No data provided";

    const collection = await violations();

    const propertyId = checkId(data.propertyId, "propertyId");
    const buildingAddress = checkString(data.buildingAddress, "address");
    const violationType = checkString(data.violationType, "type");
    const violationDescription = checkString(data.violationDescription, "description");

    let daysRemaining = null;
    let isActionable = false;

    if (data.originalCertifyByDate) {
        const diff = Math.ceil(
            (new Date(data.originalCertifyByDate) - new Date()) / (1000 * 60 * 60 * 24)
        );
        daysRemaining = diff;
        isActionable = diff <= 0;
    }

    const newViolation = {
        _id: `viol-${uuidv4()}`,
        propertyId,
        buildingAddress,
        normalizedAddress: buildingAddress.toLowerCase(),

        violationType,
        violationDescription,
        violationStatus: "Open",

        violationClass: data.violationClass || "B",
        borough: data.borough || "",
        zipCode: data.zipCode || "",

        originalCertifyByDate: data.originalCertifyByDate || null,
        inspectionDate: data.inspectionDate || null,

        repairScheduledAt: null,
        resolvedAt: null,

        daysRemaining,
        isActionable,

        remediationStatus: {
            currentState: "Open",
            updatedByUserId: null,
            updatedAt: new Date(),
            notes: ""
        },

        statusHistory: [
            {
                state: "Open",
                changedAt: new Date(),
                changedBy: "system"
            }
        ],

        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await collection.insertOne(newViolation);
    if (!result.acknowledged) throw "Could not create violation";

    const propCollection = await (await import("../config/mongoCollections.js")).properties();

    await propCollection.updateOne(
        { _id: propertyId },
        { $push: { violations: newViolation._id } }
    );

    return newViolation;
};

export const searchViolations = async (query) => {
    query = checkString(query, "search query");

    const collection = await violations();
    const results = await collection.find({
        $or: [
            { buildingAddress: { $regex: query, $options: "i"} },
            { violationType: { $regex: query, $options: "i"} },
            { violationStatus: { $regex: query, $options: "i"} },
            { borough: { $regex: query, $options: "i"} },
            { zipCode: { $regex: query, $options: "i"} },
        ]
    }).toArray();

    return results;
};

export const updateViolationStatus = async (id, newStatus, userId = "admin") => {
    id = checkId(id, "violationId");
    newStatus = checkString(newStatus, "status");

    const collection = await violations();

    const updateInfo = await collection.updateOne(
        { _id: id },
        {
            $set: {
                violationStatus: newStatus,
                "remediationStatus.currentState": newStatus,
                "remediationStatus.updatedByUserId": userId,
                "remediationStatus.updatedAt": new Date(),
                updatedAt: new Date()
            },
            $push: {
                statusHistory: {
                    state: newStatus,
                    changedAt: new Date(),
                    changedBy: userId
                }
            }
        }
    );

    if (updateInfo.modifiedCount === 0) throw "Could not update violation";

    return await getViolationById(id);
};