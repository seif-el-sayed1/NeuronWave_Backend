const mongoose = require("mongoose");
const localizationSetUp = require("../utils/modelLocalizationSetUp");

const countrySchema = mongoose.Schema(
  {
    nameEn: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "English name is required"]
    },
    nameAr: {
      type: String,
      default: " ",
      required: [true, "Arabic name is required"]
    }
  },
  {
    timestamps: true
  }
);

countrySchema.set("toObject", {
  virtuals: true
});

module.exports = mongoose.model("Country", countrySchema);
