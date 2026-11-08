const getEmailOtpSubject = ({ userId, email }: { userId: string; email: string }) => {
    const subject = `email:${userId}:${email}`;

    return subject;
};

export default getEmailOtpSubject;
