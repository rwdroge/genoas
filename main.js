/*
 * genoeas - Program to generate an OpenAPI spec file from catalog file
 *
 * @author egarcia
 */
/*jslint node:true */
/*eslint-env node */

"use strict";

// Import Modules
var URL = require("url");
var http = require("http");
var fs = require("fs");
var path = require("path");

var yaml = require("js-yaml");

// Variables
var operationSummary = {
    create: "Creates {1} records",
    read: "Gets {1} records",
    update: "Updates {1} records",
    delete: "Deletes {1} records",
    submit: "Submits multiple {1} updates",
    invoke: "Invokes Operation",
    count: "Count operation for {1}"
};

var operationDescription = {
    create: "Creates one or more new `{1}` records.",
    read: "Gets one or more `{1}` records, based on a **filter** string.",
    update: "Updates one or more `{1}` records.",
    delete: "Deletes one or more `{1}` records.",
    submit: "Submits one or more updates (create, update, delete) in a single request."
};

var paramDescription = {
    filter: "filter string with ABL query or custom format.",
    "filter-JFP": "filter string with JFP-formated query, ABL query or custom format."
};

// Functions
 function DEBUG() {
     var params = [], i;
     for (i = 0; i < 6; i += 1) {
         params[i] = arguments[i] || "";
     }
     console.log("DEBUG: " + params[0],
         params[1],
         params[2],
         params[3],
         params[4],
         params[5]);
 }

/**
 * Generates schema definitions for OpenAPI 3.0.0.
 * 
 * @param {any} oasModel - OpenAPI spec object
 * @param {any} resource - The resource object
 * @param {string} dataSet - The name of the dataSet
 * @param {string} tableRef - The name of the table reference
 */
function genTableRefDef_v3(oasModel, resource, dataSet, tableRef) {
    var tableRefArray, tableRefItem, definition;

    tableRefArray = tableRef + "Array"; 
    tableRefItem = tableRef + "Item";

    console.log(oasModel, resource, dataSet, tableRef);

    if (dataSet) {
        definition = resource.schema.properties[dataSet].properties[tableRef];
        //console.log(definition);
        oasModel.components.schemas[dataSet].properties[dataSet].properties[tableRef] = {
            "$ref": "#/components/schemas/" + tableRefArray
        };
    } else {
        definition = resource.schema.properties[tableRef];
    }
    oasModel.components.schemas[tableRef] = {
        type: "object",
        properties: {}
    };
    oasModel.components.schemas[tableRef].properties[tableRef] = {
        "$ref": "#/components/schemas/" + tableRefArray
    };    
    oasModel.components.schemas[tableRefArray] = {
        type: "array",
        items: {
            "$ref": "#/components/schemas/" + tableRefItem
        }
    };

    oasModel.components.schemas[tableRefItem] = {};
    oasModel.components.schemas[tableRefItem].type = "object";
    oasModel.components.schemas[tableRefItem].properties = {};
    Object.keys(definition.items).forEach(function (propertyName) {
        if (propertyName.charAt(0) !== "_") {
            oasModel.components.schemas[tableRefItem].properties[propertyName] = {};
            oasModel.components.schemas[tableRefItem].properties[propertyName].type = definition.items[propertyName].type;
            if (definition.items[propertyName].type === "array") {
                oasModel.components.schemas[tableRefItem].properties[propertyName].items = definition.items[propertyName].items;
            }
        }
    });
}

/**
 * Generates schema definitions for OpenAPI 2.0.
 * 
 * @param {any} oasModel - OpenAPI spec object
 * @param {any} resource - The resource object
 * @param {string} dataSet - The name of the dataSet
 * @param {string} tableRef - The name of the table reference
 */
function genTableRefDef_v2(oasModel, resource, dataSet, tableRef) {
    var tableRefArray, tableRefItem, definition;

    tableRefArray = tableRef + "Array"; 
    tableRefItem = tableRef + "Item";

    if (dataSet) {
        definition = resource.schema.properties[dataSet].properties[tableRef];
        oasModel.definitions[dataSet].properties[dataSet].properties[tableRef] = {
            "$ref": "#/definitions/" + tableRefArray
        };
    } else {
        definition = resource.schema.properties[tableRef];
    }
    oasModel.definitions[tableRef] = {
        type: "object",
        properties: {}
    };
    oasModel.definitions[tableRef].properties[tableRef] = {
        "$ref": "#/definitions/" + tableRefArray
    };    
    oasModel.definitions[tableRefArray] = {
        type: "array",
        items: {
            "$ref": "#/definitions/" + tableRefItem
        }
    };

    oasModel.definitions[tableRefItem] = {};
    oasModel.definitions[tableRefItem].type = "object";
    oasModel.definitions[tableRefItem].properties = {};
    Object.keys(definition.items.properties).forEach(function (propertyName) {
        if (propertyName.charAt(0) !== "_") {
            oasModel.definitions[tableRefItem].properties[propertyName] = {};
            oasModel.definitions[tableRefItem].properties[propertyName].type = definition.items.properties[propertyName].type;
            if (definition.items.properties[propertyName].type === "array") {
                oasModel.definitions[tableRefItem].properties[propertyName].items = definition.items.properties[propertyName].items;
            }
        }
    });
}

/** 
 * Returns object with OpenAPI 3.0 specification for specified Data Service Catalog.
 * 
 * @param {any} options - Options for the OpenAPI spec
 */
function catalogToOAS_v3(options) {

    console.log("Options :", options);
    // OpenAPI Spec
    var oasModel = {};
    var name1,
        payload,
        pathName,
        pathObject,
        isCRUD,
        hasOutputParameter,
        description;

    oasModel.openapi = options.target;

    // info
    oasModel.info = {};
    oasModel.info.title = options.title;
    oasModel.info.description = options.description;
    oasModel.info.version = options.version;

    //console.log("DEBUG OPTIONS: ", options);

    // servers
    if (options.serviceURI) {
        oasModel.servers = [];
        oasModel.servers.push({
            url: options.serviceURI + options.catalog.services[0].address
        });
    } else if (options.serviceURI === "") {
        oasModel.servers = [];
        oasModel.servers.push({
            url: options.catalog.services[0].address
        });
    }

    // paths
    oasModel.paths = {};
    // components
    oasModel.components = {};
    oasModel.components.schemas = {};

    // Process resources
    options.catalog.services[0].resources.forEach(function (resource) {
        // Generate Definitions
        // Name of DataSet

        //console.log(options.catalog.services[0]);
        //DEBUG(resource.name);
        
        name1 = Object.keys(resource.schema.properties)[0];
        

        oasModel.components.schemas[name1] = {
            type: "object",
            properties: {}
        };
        oasModel.components.schemas[name1].properties[name1] = {};
        oasModel.components.schemas[name1].properties[name1].properties = {};

         //DEBUG(resource.schema.properties);
         //DEBUG("whatever: ", resource.schema.properties[name1]);

        if (resource.schema.properties[name1].type === "object") {
            Object.keys(resource.schema.properties[name1].properties).forEach(function (tableRef) {
                genTableRefDef_v3(oasModel, resource, name1, tableRef);
            }); 
        } else if (resource.schema.properties[name1].type === "array") {
            genTableRefDef_v3(oasModel, resource, null, name1);
        } else {
            console.log("Error: Unexpected schema definition in catalog file");
        }

        // path
        oasModel.paths[resource.path] = {};
        resource.operations.forEach(function (operation) {

            // Skip delete operations
            // OpenAPI 3.0 does not support delete operations with a payload
            if (operation.type === "delete") {
                return;
            }
            // Initialize flags
            hasOutputParameter = false;

            // Calculate pathName
            if (operation.path === "" || operation.path?.charAt(0) !== "/" ) {
                // CRUD operation
                pathName = resource.path;
                isCRUD = true;
            } else {
                pathName = resource.path + operation.path;
                isCRUD = false;
            }
            pathName = pathName?.split("?")[0];
            if (!oasModel.paths[pathName]) {
                oasModel.paths[pathName] = {};
            }
            //console.log("oasModel: ", oasModel);    
            oasModel.paths[pathName][operation.verb] = {};
            pathObject = oasModel.paths[pathName][operation.verb];

            

            if (operation.summary) {
                pathObject.summary = operation.summary;
            } else {
                pathObject.summary = operationSummary[operation.type] || "";
                
                pathObject.summary = pathObject.summary.replace("{1}", Object.keys(resource.schema.properties)[0]);
                
                
            }
            if (operation.description) {
                pathObject.description = operation.description;
            } else {
                pathObject.description = operationDescription[operation.type] || "";
                pathObject.description = pathObject.description.replace("{1}", Object.keys(resource.schema.properties)[0]);
                
            }

            if (operation.params.length > 0) {
                if (!pathObject.parameters) {
                    pathObject.parameters = [];
                }
                operation.params.forEach(function (param) {
                    if (isCRUD) {
                        payload = {
                            "application/json": {
                                schema: {
                                    "$ref": "#/components/schemas/" + param.name
                                }
                            }
                        };
                    } else {
                        payload = {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        response: {
                                            type: "object"
                                        }
                                    }
                                }
                            }
                        };
                    }

                    console.log("payload", payload);
                    switch (param.type) {
                    case "REQUEST_BODY":
                        if (isCRUD) {
                            description = paramDescription[param.name] || "Input parameter";
                            pathObject.requestBody = {
                                description: description,
                                required: true,
                                content: payload
                            };
                        }
                        break;
                    case "QUERY":
                        description = paramDescription[param.name] || "Input query parameter";
                        if (operation.mappingType) {
                            description = paramDescription[param.name + "-" + operation.mappingType] || description;
                        }
                        pathObject.parameters.push({
                            name: param.name,
                            in: "query",
                            description: description,
                            schema: {
                                type: "string"
                            }
                        });
                        break;
                    case "RESPONSE_BODY":
                        hasOutputParameter = true;

                        // if (!oasModel.components.schemas[param.name]) {
                        //     oasModel.components.schemas[param.name] = {
                        //         type: "object",
                        //         properties: {}
                        //     };
                        // }

                        pathObject.responses = {
                            "200": {
                                description: "Successful response",
                                content: payload
                            }
                        };
                        break;
                    }

                    if (!hasOutputParameter) {
                        if (isCRUD) {
                            pathObject.responses = {
                                "200": {
                                    description: "OK",
                                    content: payload
                                }
                            };
                        }
                    }
                });
            } else {
                pathObject.responses = {
                    "200": {
                        description: "OK"
                    }
                };
            }
            console.log(pathObject.responses);
        });
    });
    return oasModel;
}

/** 
 * Returns object with OpenAPI 2.0 specification for specified Data Service Catalog.
 * 
 * @param {any} options - Options for the OpenAPI spec
 */
function catalogToOAS_v2(options) {
    // OpenAPI Spec
    var oasModel = {};
    var name1,
        payload,
        pathName,
        pathObject,
        isCRUD,
        hasOutputParameter,
        description,
        url,
        parsedURL;

    oasModel.swagger = options.target;

    // info
    oasModel.info = {};
    oasModel.info.title = options.title;
    oasModel.info.description = options.description;
    oasModel.info.version = options.version;

    // console.log("DEBUG: ", options);

    // servers
    if (options.serviceURI) {
        url = options.serviceURI + options.catalog.services[0].address;
        parsedURL = URL.parse(url);
        oasModel.host = parsedURL.host;
        oasModel.basePath = parsedURL.pathname; 
        oasModel.schemes = [ parsedURL.protocol.replace(":", "") ];    
    } else if (options.serviceURI === "") {
        oasModel.basePath = options.catalog.services[0].address; 
        oasModel.schemes = [ "http" ];
    }

    // paths
    oasModel.paths = {};
    // Definitions
    oasModel.definitions = {};

    // Process resources
    options.catalog.services[0].resources.forEach(function (resource) {
        // Generate Definitions
        // Name of DataSet
        // DEBUG(resource.name);
        name1 = Object.keys(resource.schema.properties)[0];

        oasModel.definitions[name1] = {
            type: "object",
            properties: {}
        };
        oasModel.definitions[name1].properties[name1] = {};
        oasModel.definitions[name1].properties[name1].properties = {};

        // DEBUG(name1);
        // DEBUG(resource.schema.properties[name1]);

        if (resource.schema.properties[name1].type === "object") {
            Object.keys(resource.schema.properties[name1].properties).forEach(function (tableRef) {
                genTableRefDef_v2(oasModel, resource, name1, tableRef);
            }); 
        } else if (resource.schema.properties[name1].type === "array") {
            genTableRefDef_v2(oasModel, resource, null, name1);
        } else {
            console.log("Error: Unexpected schema definition in catalog file");
        }

        // path
        oasModel.paths[resource.path] = {};
        console.log("Resource.Operations: ", resource.operations);
        resource.operations.forEach(function (operation) {
            // Initialize flags
            hasOutputParameter = false;

            // Calculate pathName
            if (operation.path === "" || operation.path.charAt(0) !== "/") {
                // CRUD operation
                pathName = resource.path;
                isCRUD = true;
            } else {
                pathName = resource.path + operation.path;
                isCRUD = false;
            }
            pathName = pathName.split("?")[0];
            if (!oasModel.paths[pathName]) {
                oasModel.paths[pathName] = {};
            }

            oasModel.paths[pathName][operation.verb] = {};
            pathObject = oasModel.paths[pathName][operation.verb];
            //console.log("summary ", operation.summary);
            if (operation.summary) {
                pathObject.summary = operation.summary;
            } else {
                pathObject.summary = operationSummary[operation.type] || "";
                pathObject.summary = pathObject.summary.replace("{1}", resource.name);
            }
            if (operation.description) {
                pathObject.description = operation.description;
            } else {
                pathObject.description = operationDescription[operation.type] || "";
                pathObject.description = pathObject.description.replace("{1}", resource.name);
            }

            if (operation.params.length > 0) {
                pathObject.consumes = ["application/json"];
                if (!pathObject.parameters) {
                    pathObject.parameters = [];
                }
                operation.params.forEach(function (param) {
                    var schema;
                    if (isCRUD) {
                        schema = {
                            "$ref": "#/definitions/" + param.name
                        };
                    } else {
                        schema = {
                            type: "object",
                            properties: {
                                response: {
                                    type: "object"
                                }
                            }
                        };
                    }
                    switch (param.type) {
                    case "REQUEST_BODY":
                        if (isCRUD) {
                            description = paramDescription[param.name] || "Input parameter";
                            pathObject.parameters.push({
                                in: "body",
                                name: "body",
                                description: description,
                                required: true,
                                schema: schema
                            });
                        }
                        break;
                    case "QUERY":
                        description = paramDescription[param.name] || "Input query parameter";
                        if (operation.mappingType) {
                            description = paramDescription[param.name + "-" + operation.mappingType] || description;
                        }
                        pathObject.parameters.push({
                            name: param.name,
                            in: "query",
                            description: description,
                            type: "string"
                        });
                        break;
                    case "RESPONSE_BODY":
                        hasOutputParameter = true;
                        /*
                        if (!oasModel.components.schemas[param.name]) {
                            oasModel.components.schemas[param.name] = {
                                type: "object",
                                properties: {}
                            };
                        }
                        */

                        pathObject.responses = {
                            "200": {
                                description: "Successful response",
                                schema: schema
                            }
                        };
                        break;
                    }

                    if (!hasOutputParameter) {
                        if (isCRUD) {
                            pathObject.responses = {
                                "200": {
                                    description: "OK",
                                    content: payload
                                }
                            };
                        }
                    }
                });
            } else {
                pathObject.responses = {
                    "200": {
                        description: "OK"
                    }
                };
            }
        });
    });

    return oasModel;
}

/** 
 * Returns object with OpenAPI specification for specified Data Service Catalog.
 * 
 * @param {any} options - Options for the OpenAPI spec
 */
function catalogToOAS(options) {
    if (options.target === "2.0") {
        return catalogToOAS_v2(options);
    } else {
        return catalogToOAS_v3(options);
    }
}

/**
 * Usage message for the genoas command.
 */
function usage() {
    console.log(
        "Usage: genoas [file | url] "
        + "[--host host] "
        + "[--title title] [--desc description] "
        + "[--version version] "
        + "[--format (yaml | json)] "
        + "[--target (3.0.0 | 2.0)]"
    );
}

/** 
 * Generates an OpenAPI specification file from a Data Service Catalog based on the specified options.
 * 
 * @param {any} options - Options to generate the OpenAPI spec file
 */
function processCatalog(options) {
    // console.log("DEBUG: serviceURI: " + options.serviceURI);
    var defaultOutputFile = "oas.json";
    var oasModel = catalogToOAS(options);

    if (options.format === "yaml") {
        oasModel = yaml.dump(oasModel);
        defaultOutputFile = "oas.yaml";
    } else {
        oasModel = JSON.stringify(oasModel, null, 4);
    }
    options.output = options.output || defaultOutputFile;
    fs.writeFile(options.output, oasModel, function (err) {
        if (err) {
            console.error("Error while writing " + options.output + ".\nError: " + err.message);
        } else {
            console.log("OpenAPI spec written to " + options.output);
        }
    });
}

/** 
 * Processes Data Service Catalog file and generates OpenAPI spec file.
 *
 * @param {string} fileName - the path to the catalog file
 * @param {any} options - Options to generate the OpenAPI spec file
 */
function processFile(fileName, options) {
    var target = options.target || "3.0.0";
    var format = options.format || "yaml";
    var defaultOutputFile = "oas.yaml";

    if (options.format === "json") {
        defaultOutputFile = "oas.json";
    }
    fs.readFile(fileName, "utf8", function (err, data) {
        if (err) {
            console.error("Error while reading catalog.json.\nError: " + err.message);
        } else {
            var pathObject = path.parse(fileName);
            
            processCatalog({
                target: target,
                format: format,
                title: options.title || "Data Service",
                description: options.desc || "OpenEdge Data Service.",
                version: options.version || "1.0.0",
                serviceURI: options.host || "",
                catalog: JSON.parse(data),
                output: pathObject.name ? (pathObject.name + "." + format) : defaultOutputFile
            });
        }
    });
}

/** 
 * Processes Data Service Catalog file from URL and generates OpenAPI spec file.
 *
 * @param {string} url - the URL to the catalog file
 * @param {any} options - Options to generate the OpenAPI spec file
 */
function processURL(url, options) {
    var request = http.get({
        host: url.hostname,
        path: url.path,
        port: url.port
    }, function (response) {
        var data = "";
        response.on("data", function (chunk) {
            data += chunk;
        });
        response.on("end", function () {
            var target = options.target || "3.0.0";
            var format = options.format || "yaml";
            var pathName = url.path.split("/");

            pathName = pathName[pathName.length - 1];
            pathName = pathName.split(".");
            // console.log(pathName[0]);

            try {
                
                processCatalog({
                    target: target,
                    format: format,
                    title: options.title || "Data Service",
                    description: options.desc || "OpenEdge Data Service.",
                    version: options.version || "1.0.0",
                    serviceURI: options.host
                            || (url.protocol
                            + "//" + url.hostname
                            + (url.port ? (":" + url.port) : "") + "/" + url.path.split("/")[1]),
                    catalog: JSON.parse(data),
                    output: pathName[0] + "." + format
                });
            } catch (e) {
                console.log("Error while loading catalog file.\nError: " + e.message);
                console.log(e);
            }
        });
    });
    request.on("error", function (error) {
        console.log("ERROR: " + error);
    });
    request.end();
}

function main(args) {
    var catalogFile,
        url,
        options = {},
        i;

    for (i = 1; i < args.length; i += 1) {
        // console.log("DEBUG: args: " + i);
        // console.log("DEBUG: args: " + args[i]);
        // switch (args[i]) {
        // case "--host":
        //     host = args[++i];
        //     break;

        switch (args[i].substring(0, 2)) {
        case "--":
            options[args[i].substring(2)] = args[i + 1];
            switch (args[i].substring(2)) {
            case "format":
                if (!(args[i + 1] === "yaml" || args[i + 1] === "json")) {
                    console.log("ERROR: Unexpected format " + args[i + 1]);
                    return;
                }
                break;
            case "target":
                if (!(args[i + 1] === "3.0.0" || args[i + 1] === "2.0")) {
                    console.log("ERROR: Unexpected target spec version " + args[i + 1]);
                    return;
                }
                break;
            }
            i += 1;
            break;
        default:
            catalogFile = args[i];
            url = URL.parse(args[i]);
            break;
        }
    }
    if (args.length === 1 || !catalogFile) {
        usage();
        return;
    }

    console.log("Reading catalog file '" + catalogFile);
    try {
        if (!url.hostname || !url.protocol) {
            processFile(catalogFile, options);
        } else {
            processURL(url, options);
        } 
    } catch (e) {
        console.log("ERROR: " + e.message);
    }
}

// Main Block
var args = process.argv.slice(1);

// args = ["", "http://oemobiledemo.progress.com/OEMobileDemoServices/static/CustomerService.json"];
// args = ["", "http://oemobiledemo.progress.com/OEMobileDemoServices/static/SportsService.json"];
// args = ["", "samples\\SportsService.json"];
// args = ["", "C:\\Developer\\genoas\\samples\\SportsService.json"];
main(args);
