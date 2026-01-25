const translate = (str, lang = "en") => {
  if (lang?.toLowerCase() === "ar") return ar[str] || str;
  return str;
};

const ar = {
  //user
  "User not found!": "المستخدم غير موجود",
  "User not found": "المستخدم غير موجود",
  "Doctor not found!" : "الدكتور غير موجود",
  "Doctor not found" : "الدكتور غير موجود",
  "Incorrect Email or password": "الايميل او كلمة المرور غير صحيحة",
  "Verification OTP is required" : "رمز التحقق مطلوب",
  "Invalid request": "طلب غير صالح",
  "Verification OTP is expired": "رمز التحقق منتهي الصلاحية",
  "Invalid Verification OTP": "رمز التحقق غير صحيح",
  "Incorrect password": "كلمة المرور غير صحيحة",
  "OTP isn't found!": "رمز التحقق غير موجود",
  "Your account is not verified yet" : "لم يتم التحقق من حسابك",
  "Reset OTP is expired": "نتهت صلاحية رمز إعادة تعيين كلمة المرور",
  "Invalid reset code": "رمز إعادة التعيين غير صالح",
  "User is already deactivated" : "المستخدم معطل بالفعل",
  "Doctor is already deactivated" : "الدكتور معطل بالفعل",
  "Medical Number is required" : "رقم الهوية الطبية مطلوب",
  // user validator
  "Full Name is required" : "اسم المستخدم مطلوب",
  "Email is required" : "الايميل مطلوب",
  "Password is required" : "كلمة المرور مطلوبة",
  "Phone is required" : "رقم الهاتف مطلوب",
  "Emergency Contact is required" : "رقم الهاتف الطوارئ مطلوب",
  "Age is required" : "العمر مطلوب",
  "Password must be at least 6 characters" : "كلمة المرور يجب ان تكون على الاقل 6 حروف",
  "Confirm Password is required" : "تاكيد كلمة المرور مطلوب",
  "Passwords do not match" : "كلمات المرور غير متطابقة",
  "Phone number must start with '0' and contain exactly 11 digits" : "رقم الجوال يجب ان يبدا ب '0' ويحتوي على 11 رقم",
  "Duplicated Phone Number" : "رقم الهاتف مكرر",
  "This Phone Number Has Been Verified Before" : "تم التحقق من هذا الرقم من قبل",
  "Duplicated Email" : "البريد الالكتروني مكرر",
  "This Email Has Been Verified Before" : "تم التحقق من هذا البريد من قبل",
  "You Can't Block Yourself" : "لا يمكنك حظر نفسك",
  "Medical Specialty is required" : "التخصص الطبي مطلوب",
  "Invalid Medical Specialty" : "تخصص غير صالح",
  "Gender is required" : "النوع مطلوب",
  "DateOfBirth is required" : "تاريخ الميلاد مطلوب",
  // patients
  "Notes field is required" : "الملاحظات مطلوبة",
  "You are not allowed to update this patient" : "لا يمكنك تحديث هذا المريض",
  "Phone must be a valid phone number" : "رقم الهاتف يجب ان يكون رقم صالح",
  "Email must be a valid email": "البريد الإلكتروني غير صحيح",
  "EmergencyContact is required" : "رقم الهاتف الطوارئ مطلوب",
  "MedicalHistory is required": "التاريخ المرضي مطلوب",
  "Diagnosis is required": "التشخيص مطلوب",
  "Address is required": "العنوان مطلوب",
  // global validator
  "Password must be at least 8 characters long" : "كلمة المرور يجب ان تكون على الاقل 8 حروف",
  "Confirm password must match password" : "تاكيد كلمة المرور يجب ان تكون متطابقة مع كلمة المرور",
  "Confirm password is required" : "تاكيد كلمة المرور مطلوب",
  "Email must be provided" : "الايميل مطلوب",
  "Reset code is not verified" : "لم يتم التحقق من رمز التعيين",
  "Invalid language" : "لغة غير صالحة",
  "Language is required" : "اللغة مطلوبة",
  "Invalid phone Number" : "رقم الهاتف غير صالح",
  "Invalid Email Address" : "عنوان البريد الالكتروني غير صالح",
  "Invalid phone number format" : "تنسيق رقم الهاتف غير صالح",
  "Current password is required" : "كلمة المرور الحالية مطلوبة",
  "Language is required" : "اللغة مطلوبة",
  "Invalid Language" : "لغة غير صالحة",
  // appointment
  "Appointment not found" : "الموعد غير موجود",
  "Patient not found" : "المريض غير موجود",
  "Appointment cannot be updated unless it is accepted" : "لا يمكن تحديث الموعد حتى يتم قبوله",
  "Only pending appointments can be changed" : "يمكن تحديث المواعيد المعلقة فقط",
  "Patients can only change status to canceled" : "المرضى يمكنهم فقط تغيير الحالة إلى ملغي",
  "You are not allowed to change this appointment status" : "لا يمكنك تغيير حالة هذا الموعد",
  "Rejection reason is only allowed when status is rejected" : "يمكن تحديد سبب الرفض فقط عند الرفض",
  "Rejection reason is required" : "سبب الرفض مطلوب",
  //appointment validation
  "Patient not allowed" : "غير مسموح ادخال مريض",
  "Doctor not allowed" : "غير مسموح ادخال الدكتور ",
  "Appointment date and time cannot be in the past" : "لا يمكن تحديد تاريخ ووقت الموعد في الماضي",
  "Date and time not allowed for patients" : "المرضي غير مسموح لهم تحديد التاريخ و الوقت",
  "You are not allowed to update this appointment" : "لا يمكنك تحديث هذا الموعد",
  "Patient is required": "المريض مطلوب",
  "Doctor is required": "الطبيب مطلوب",
  "Date is required": "التاريخ مطلوب",
  "Time is required": "الوقت مطلوب",
  "Type is required": "نوع الموعد مطلوب",
  "Date is not allowed": "التاريخ غير مسموح به",
  "Time is not allowed": "الوقت غير مسموح به",
  //analysis
  "Analysis not found" : "التحليل غير موجود",
  "Invalid status" : "حالة غير صالحه",
  "Analysis is not pending, you can't " : "التحليل غير معلق، لا يمكنك تغير حالته",
  "Analysis already " : "التحليل بالفعل ",  
  "modelType and doctor are required" : "نوع التحليل والطبيب مطلوبين",
  "No files uploaded" : "لم يتم تحميل الملفات",
  "id and consultation are required" : "المعرف والاستشارة مطلوبين",
  "Analysis is not approved" : "غير موافق علي التحليل",
  //auth middleware
  "Session expired, please login again..." : "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى...",
  "account is deactivated" : "تم إلغاء تنشيط هذا الحساب",
  "Password recently changed, please login again..." : "تم تغيير كلمة المرور مؤخرا، يرجى تسجيل الدخول مرة أخرى...",
  "not found" : "غير موجود",
  "Invalid token, please login again..." : "رمز غير صالح، يرجى تسجيل الدخول مرة أخرى...",
  "Invalid token role, please login again..." : "صلاحية رمز غير صالحة، يرجى تسجيل الدخول مرة أخرى...",
  "Token has expired, please login again..." : "انتهت صلاحية الرمز، يرجى تسجيل الدخول مرة أخرى...",
  "Not allowed to access this route" : "غير مسموح بالوصول إلى هذا المسار",
  // multer
  "Not an image, please upload only Image" : "ليس صورة، يرجى تحميل صورة فقط",
  "Not a PDF, please upload only PDFs" : "ليس PDF، يرجى تحميل PDFات فقط",
  "Not a video, please upload only Video" : "ليس فيديو، يرجى تحميل فيديوات فقط",
  "Only images, videos or voice allowed" : "يمكن تحميل صور، فيديوات او صوت فقط",
  // send email
  "Unable to send an email, please try again later." : "لا يمكن ارسال بريد، يرجى المحاولة مرة أخرى لاحقا.", 
  // errors middlewares
  "Something went wrong": "حدث خطأ ما",  
  "Invalid token, Please login again ...": "الرمز غير صحيح، يرجى تسجيل الدخول مرة أخرى",
  "Expired token, Please login again ...": "الرمز منتهي الصلاحية، يرجى تسجيل الدخول مرة أخرى",
  "Invalid": "غير صحيح",
  "Invalid Input Data": "بيانات غير صحيحة",
  "is already used": "مستخدم بالفعل",
  "Arabic": "العربي",
  "English": "الإنجليزي",  
  "email": "البريد الإلكتروني",
  "phone": "رقم الهاتف",
  "username": "اسم المستخدم",
  "password": "كلمة المرور",
  "name": "الاسم",
  "fullName": "الاسم الكامل",
  "address": "العنوان",
  "age": "العمر",
  "gender": "النوع",
  // notifications
  "Notification not found" : "الاشعار غير موجود",
  // appointment notifications
  "You have a new appointment request" : "لديك طلب موعد جديد",
  "booked a new appointment. Please accept or reject the request." : "تم حجز موعد جديد. يرجى قبول او رفض الطلب.",
  "Your appointment has been accepted!" : "تم قبول موعدك!",
  "Your appointment has been rejected!" : "تم رفض موعدك!",
  "Your appointment has been canceled!" : "تم إلغاء موعدك!",
  "Appointment has been Canceled!" : "تم إلغاء الموعد!",
  "canceled the appointment" : "الغي الموعد",
  "rejected your appointment" : "رفض موعدك",
  "canceled your appointment" : "الغى موعدك",
  "Reason:" : "السبب:",
  "accepted your appointment scheduled on" : "قبلت موعدك المجدول في",
  "at" : "الساعه",
  // analysis notifications
  "Analysis Status Update" : "تحديث حالة التحليل",
  "has approved your analysis" : "قبل طلب تحليلك",
  "has rejected your analysis" : "رفض طلب تحليلك",
  "Your analysis has been Approved" : "تمت الموافقة على التحليل",
  "Your analysis has been rejected" : "تم رفض التحليل",
  "New Analysis Request" : "طلب تحليل جديد",
  "You have a new analysis request" : "لديك طلب تحليل جديد",
  "You have a new analysis report" : "لديك تقرير تحليل جديد",
  "wrote you a consultation." : "كتب لك استشارة.",
  // hospital
  "Hospital not found": "المستشفى غير موجوده",
  // country, city
  "Country not found": "البلد غير موجود",
  "City not found": "المدينة غير موجودة",
  // super doctor
  "Invalid medical number format" : "تنسيق الرقم طبي غير صالح",
  "medicalNumber is already used" : "الرقم الطبي مستخدم بالفعل"
};

function translateNumbers(input, lang = "en") {
  console.log("🚀 ~ translateNumbers ~ lang:", lang);
  lang = lang.toLowerCase();
  let localizedNumber;
  if (lang === "ar") localizedNumber = latinToArabicNumbers(input, lang);
  else localizedNumber = arabicToLatinNumbers(input, lang);
  console.log("🚀 ~ translateNumbers ~ localizedNumber:", localizedNumber);
  return localizedNumber;
}

function latinToArabicNumbers(input) {
  const latinNumbers = "0123456789"; // Latin digits (0-9)
  const arabicNumbers = "٠١٢٣٤٥٦٧٨٩"; // Corresponding Arabic digits
  return input.replace(/[0-9]/g, (digit) => arabicNumbers[latinNumbers.indexOf(digit)]);
}

function arabicToLatinNumbers(input) {
  const arabicNumbers = "٠١٢٣٤٥٦٧٨٩"; // Arabic digits (0-9)
  const latinNumbers = "0123456789"; // Corresponding Latin digits
  return input.replace(/[٠-٩]/g, (digit) => latinNumbers[arabicNumbers.indexOf(digit)]);
}

module.exports = { translate, translateNumbers };