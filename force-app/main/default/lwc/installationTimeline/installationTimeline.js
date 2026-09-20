import { LightningElement, api, wire } from "lwc";
import { getRelatedListRecords } from "lightning/uiRelatedListApi";

const COLUMNS = [
  { label: "Batch", fieldName: "name", type: "text" },
  { label: "Panels", fieldName: "quantity", type: "number", cellAttributes: { alignment: "left" } },
  { label: "Arrives", fieldName: "arrival", type: "date-local" },
  { label: "Serial prefix", fieldName: "serial", type: "text" }
];

export default class InstallationTimeline extends LightningElement {
  @api recordId;
  columns = COLUMNS;
  rows = [];
  error;

  @wire(getRelatedListRecords, {
    parentRecordId: "$recordId",
    relatedListId: "Panel_Batches__r",
    fields: [
      "Panel_Batch__c.Name",
      "Panel_Batch__c.Quantity__c",
      "Panel_Batch__c.Arrival_Date__c",
      "Panel_Batch__c.Serial_Prefix__c"
    ],
    sortBy: ["Panel_Batch__c.Arrival_Date__c"]
  })
  wiredBatches({ data, error }) {
    if (data) {
      this.rows = data.records.map((record) => ({
        id: record.id,
        name: record.fields.Name.value,
        quantity: record.fields.Quantity__c.value,
        arrival: record.fields.Arrival_Date__c.value,
        serial: record.fields.Serial_Prefix__c.value
      }));
      this.error = undefined;
    } else if (error) {
      this.rows = [];
      this.error = "The panel batches for this installation could not be read.";
    }
  }

  get hasRows() {
    return this.rows.length > 0;
  }
}
