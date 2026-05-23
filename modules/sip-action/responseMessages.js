const responseMessages = {
  newCallFailed: {
    message: "New Called Failed",
    code: 603,
  },
  callEnded: {
    message: "Call ended successfully.",
    code: 200,
  },
  successStatus: {
    message: "Status Fetched Successfuly",
    code: 200,
  },
  userNotFound: {
    message: "User not found",
    code: 400,
  },
  somethingWentWrong: {
    message: "Somthing went wrong!!",
    code: 400,
  },
  notValidAuthStatus: {
    message: "Not a Valid auth status",
    code: 400,
  },
  missingField: {
    message: "Mandatory filed missing in the request",
    code: 400,
  },
};

export default { responseMessages };
